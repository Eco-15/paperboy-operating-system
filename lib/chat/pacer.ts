// ── Stream pacer ─────────────────────────────────────────────────────────────
// Text used to render "choppy" because the UI was slaved directly to network
// arrival: a 40ms setTimeout committed whatever happened to land in that window.
// A burst of eight deltas appeared as one lump; a 300ms model stall showed nothing.
// setTimeout also isn't frame-aligned, so it beat against vsync — some frames got
// two commits, some got none.
//
// The fix is to decouple *arrival* from *display*. Events go into a queue; a
// requestAnimationFrame loop releases characters at a smooth, adaptive rate. The
// network can be as lumpy as it likes — the reader always sees an even flow.
//
// Ordering is preserved exactly: non-text events (tool calls, proposals, files)
// sit in the SAME queue as text, so a tool card can never jump ahead of text that
// was streamed before it.

export interface PacerCallbacks<E> {
  /** Reveal a slice of text (already ordered). */
  onText: (slice: string) => void;
  /** Apply a non-text event. Runs instantly — these have no "typing" to pace. */
  onEvent: (ev: E) => void;
  /** Called at most once per frame, only when something changed. */
  onCommit: () => void;
}

/** How aggressively the backlog is drained. Tuned by feel, not theory. */
const DRAIN_DIVISOR = 6; // release ~1/6th of the backlog per frame…
const MIN_CHARS = 2; //     …but never fewer than this (keeps short tails moving)…
const MAX_CHARS = 140; //   …and never so many that a burst becomes a visible lump.
// Once the network is done there's nothing left to wait for, so empty the queue
// briskly rather than making the user watch a slow typewriter finish.
const FINISH_DIVISOR = 2;
const FINISH_MIN = 32;

interface TextItem {
  kind: "text";
  text: string;
}
interface EventItem<E> {
  kind: "event";
  ev: E;
}
type Item<E> = TextItem | EventItem<E>;

export interface Pacer<E> {
  /** Queue a text delta for paced reveal. */
  pushText: (text: string) => void;
  /** Queue a non-text event (keeps its position relative to text). */
  pushEvent: (ev: E) => void;
  /** Stop accepting input and drain what's left. Resolves when the queue is empty. */
  finish: () => Promise<void>;
  /** Abandon pacing and reveal everything immediately (Stop button). */
  flushNow: () => void;
  /** Hard stop: drop the queue and fire no further callbacks (abort / error). */
  cancel: () => void;
}

export function createPacer<E>(cb: PacerCallbacks<E>): Pacer<E> {
  const queue: Item<E>[] = [];
  let pendingChars = 0;
  let frame: number | null = null;
  let finishing = false;
  let cancelled = false;
  let resolveFinish: (() => void) | null = null;

  const drainAll = () => {
    let changed = false;
    for (const item of queue) {
      if (item.kind === "text") cb.onText(item.text);
      else cb.onEvent(item.ev);
      changed = true;
    }
    queue.length = 0;
    pendingChars = 0;
    if (changed) cb.onCommit();
  };

  const stop = () => {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  };

  const tick = () => {
    frame = null;
    if (cancelled) return;

    // Rate adapts to backlog: a big burst catches up fast, a trickle stays gentle.
    // Without this, either bursts lump or steady output crawls.
    let budget = finishing
      ? Math.max(FINISH_MIN, Math.ceil(pendingChars / FINISH_DIVISOR))
      : Math.min(MAX_CHARS, Math.max(MIN_CHARS, Math.ceil(pendingChars / DRAIN_DIVISOR)));

    let changed = false;

    while (queue.length > 0 && budget > 0) {
      const head = queue[0];

      if (head.kind === "event") {
        // Instantaneous — but only once the text queued BEFORE it has been shown.
        cb.onEvent(head.ev);
        queue.shift();
        changed = true;
        continue;
      }

      const take = Math.min(budget, head.text.length);
      cb.onText(head.text.slice(0, take));
      head.text = head.text.slice(take);
      pendingChars -= take;
      budget -= take;
      changed = true;
      if (head.text.length === 0) queue.shift();
    }

    if (changed) cb.onCommit();

    if (queue.length > 0) {
      frame = requestAnimationFrame(tick);
    } else if (finishing && resolveFinish) {
      const done = resolveFinish;
      resolveFinish = null;
      done();
    }
  };

  const schedule = () => {
    if (frame === null && !cancelled) frame = requestAnimationFrame(tick);
  };

  return {
    pushText(text) {
      if (cancelled || !text) return;
      const last = queue[queue.length - 1];
      // Coalesce adjacent deltas so the queue stays short.
      if (last?.kind === "text") last.text += text;
      else queue.push({ kind: "text", text });
      pendingChars += text.length;
      schedule();
    },

    pushEvent(ev) {
      if (cancelled) return;
      queue.push({ kind: "event", ev });
      schedule();
    },

    finish() {
      if (cancelled) return Promise.resolve();
      finishing = true;
      if (queue.length === 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        resolveFinish = resolve;
        schedule();
      });
    },

    flushNow() {
      if (cancelled) return;
      cancelled = true;
      stop();
      drainAll();
      if (resolveFinish) {
        const done = resolveFinish;
        resolveFinish = null;
        done();
      }
    },

    // On abort/error the message is being torn down, so a still-running frame loop
    // would commit stale text back into a message that no longer exists. Drop it.
    cancel() {
      cancelled = true;
      stop();
      queue.length = 0;
      pendingChars = 0;
      if (resolveFinish) {
        const done = resolveFinish;
        resolveFinish = null;
        done();
      }
    },
  };
}
