"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useChats } from "@/lib/chat/useChats";
import MessageParts from "./MessageParts";
import Canvas, { type CanvasContent } from "./Canvas";
import ArtifactPanel from "./ArtifactPanel";
import { latestArtifact, KIND_ICON } from "@/lib/chat/artifact-part";
import type { ChatMessage, Artifact } from "@/lib/chat/types";

const STARTERS = [
  "What are my top-priority deals?",
  "Summarize the pipeline by stage.",
  "What's on my calendar today?",
  "What's unread in my inbox?",
];

// One turn, memoized. The streaming loop now commits up to 60×/second, and without
// this every prior turn in the conversation re-rendered on every frame. Settled
// messages keep object identity across commits, so they now bail out immediately and
// only the live turn does any work.
const Turn = memo(function Turn({
  message,
  streaming,
  onOpenCanvas,
  onDecide,
  onOpenArtifact,
}: {
  message: ChatMessage;
  streaming: boolean;
  onOpenCanvas: (c: CanvasContent) => void;
  onDecide: (messageId: string, proposalId: string, decision: "approve" | "deny") => Promise<void>;
  onOpenArtifact: (a: Artifact) => void;
}) {
  const isAsst = message.role === "assistant";
  return (
    <article className={`chat-turn chat-turn--${message.role}`}>
      <div className="chat-turn-role">{isAsst ? "Paperboy" : "You"}</div>
      <div className="chat-turn-body">
        {isAsst ? (
          <MessageParts
            message={message}
            streaming={streaming}
            onOpenCanvas={onOpenCanvas}
            onDecide={onDecide}
            onOpenArtifact={onOpenArtifact}
          />
        ) : (
          <p className="chat-usertext">{message.text}</p>
        )}

        {isAsst && message.citations && message.citations.length > 0 && (
          <div className="chat-sources">
            <span className="chat-sources-label">Sources</span>
            {message.citations.map((c, k) =>
              c.link ? (
                <a
                  key={k}
                  href={c.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chat-source"
                >
                  {c.file}
                </a>
              ) : (
                <span key={k} className="chat-source">
                  {c.file}
                </span>
              ),
            )}
          </div>
        )}
      </div>
    </article>
  );
});

export default function ChatApp() {
  const {
    chats,
    activeChat,
    activeId,
    streaming,
    newChat,
    selectChat,
    renameChat,
    deleteChat,
    sendMessage,
    stop,
    decideProposal,
    artifact,
    openArtifact,
    editArtifact,
    closeArtifact,
  } = useChats();

  const [draft, setDraft] = useState("");
  const [canvas, setCanvas] = useState<CanvasContent | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether the view should keep following new text. Set false the moment the user
  // scrolls up to read something — nothing is more hostile than being yanked back
  // down mid-sentence — and restored when they return to the bottom.
  const stickRef = useRef(true);

  const messages = activeChat?.messages ?? [];
  // The streaming text itself, so the scroll effect fires as content GROWS. It used
  // to depend only on messages.length/streaming, so the reply grew off-screen and the
  // page lurched once at the very end.
  const liveText = streaming ? (messages[messages.length - 1]?.text ?? "") : "";

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = distanceFromBottom < 80;
  };

  useEffect(() => {
    if (!stickRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    // `auto`, not `smooth`: a smooth animation restarts on every frame of streaming
    // text and ends up fighting the content it's chasing.
    el.scrollTop = el.scrollHeight;
  }, [messages.length, streaming, liveText]);

  // Export reuses the agent's existing pptx/docx/xlsx skills. The document's current
  // text rides along on the request (useChats sends the open artifact), so the model
  // builds the file from what the user is actually looking at — including their edits —
  // rather than from its own memory of what it wrote.
  // ── Resizable split ────────────────────────────────────────────────────────
  // A document needs whatever width the reader wants to give it. Persisted per user
  // (localStorage is fine for a viewport preference — it's per-device by nature).
  const shellRef = useRef<HTMLDivElement>(null);
  const [panelW, setPanelW] = useState(560);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem("paperboyPanelW"));
    if (saved >= 320) setPanelW(saved);
  }, []);

  const clampW = (px: number) => {
    const shell = shellRef.current;
    const max = shell ? Math.max(360, shell.clientWidth - 520) : 900;
    return Math.min(Math.max(px, 360), max);
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    setResizing(true);
    const move = (ev: PointerEvent) => {
      const shell = shellRef.current;
      if (!shell) return;
      // Distance from the shell's right edge — the panel is the rightmost column.
      setPanelW(clampW(shell.getBoundingClientRect().right - ev.clientX));
    };
    const up = () => {
      setResizing(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setPanelW((w) => {
        window.localStorage.setItem("paperboyPanelW", String(w));
        return w;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const resizeKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setPanelW((w) => {
      const next = clampW(w + (e.key === "ArrowLeft" ? 24 : -24));
      window.localStorage.setItem("paperboyPanelW", String(next));
      return next;
    });
  };

  const exportArtifact = (format: "pptx" | "docx" | "xlsx" | "html") => {
    if (!artifact) return;
    if (format === "html") {
      const blob = new Blob([artifact.content], { type: "text/html" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${artifact.id}.html`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
    void sendMessage(
      `Export the open document "${artifact.title}" as a .${format} file. Its exact current text is ` +
        `in <open_document> — use that verbatim; do not re-research or re-word it.`,
    );
  };

  // ── History sidebar: collapsible + auto-tuck ────────────────────────────────
  // With a document open there isn't room for the OS nav rail AND the 264px history
  // AND the conversation AND the panel. So when a doc opens, the history tucks away
  // (and the OS rail shrinks to icons, below) to leave a clean chat | document
  // two-pane. A toggle pulls history back out any time.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // The user's manual choice for the NO-document case, remembered across visits. The
  // auto-tuck is layered on top of it and doesn't overwrite it.
  const prefCollapsedRef = useRef(false);
  const hasDoc = !!artifact;

  useEffect(() => {
    const saved = window.localStorage.getItem("paperboySidebarCollapsed") === "1";
    prefCollapsedRef.current = saved;
    setSidebarCollapsed(saved);
  }, []);

  // Auto-tuck on open, restore the user's own preference on close.
  useEffect(() => {
    setSidebarCollapsed(hasDoc ? true : prefCollapsedRef.current);
  }, [hasDoc]);

  const toggleSidebar = () => {
    setSidebarCollapsed((c) => {
      const next = !c;
      // Only a toggle made with NO document open is a lasting preference; toggling to
      // peek at history mid-document shouldn't rewrite what you see next session.
      if (!hasDoc) {
        prefCollapsedRef.current = next;
        window.localStorage.setItem("paperboySidebarCollapsed", next ? "1" : "0");
      }
      return next;
    });
  };

  // While a document is open, shrink the app-wide nav rail to icons for the widest
  // two-pane — WITHOUT touching the user's saved railCollapsed preference, so it
  // returns to whatever they had once the document closes. A scoped visual override.
  useEffect(() => {
    const shell = document.querySelector(".os-shell");
    if (!shell) return;
    if (hasDoc) shell.setAttribute("data-doc-open", "true");
    else shell.removeAttribute("data-doc-open");
    return () => shell.removeAttribute("data-doc-open");
  }, [hasDoc]);

  // The reopen affordance: once the panel is closed, the most recent document is
  // otherwise only reachable by scrolling back to its transcript card. Scan the whole
  // conversation (newest first), not just the last message — a doc stays reopenable
  // even after unrelated follow-up questions.
  let reopenable: Artifact | null = null;
  if (!artifact) {
    for (let i = messages.length - 1; i >= 0 && !reopenable; i--) {
      reopenable = latestArtifact(messages[i]);
    }
  }

  const autosize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = draft.trim();
    if (!t || streaming) return;
    setDraft("");
    requestAnimationFrame(autosize);
    void sendMessage(t);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      ref={shellRef}
      className={`chat-shell${artifact || canvas ? " has-canvas" : ""}`}
      data-resizing={resizing || undefined}
      data-sidebar={sidebarCollapsed ? "collapsed" : "open"}
      style={{ ["--chat-canvas-w" as string]: `${panelW}px` }}
    >
      {/* ── History ───────────────────────────────────────────────── */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar-top">
          <button className="chat-new" type="button" onClick={newChat}>
            + New chat
          </button>
          <button
            type="button"
            className="chat-sidebar-toggle"
            onClick={toggleSidebar}
            aria-label="Hide chat history"
            title="Hide history"
          >
            «
          </button>
        </div>
        <div className="chat-history">
          {chats.length === 0 && <div className="chat-history-empty">No chats yet.</div>}
          {chats.map((c) => (
            <div key={c.id} className={`chat-history-row ${c.id === activeId ? "is-active" : ""}`}>
              <button
                type="button"
                className="chat-history-item"
                onClick={() => selectChat(c.id)}
                title={c.title}
              >
                {c.title || "New chat"}
              </button>
              <button
                type="button"
                className="chat-history-more"
                aria-label="Chat actions"
                onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
              >
                ⋯
              </button>
              {menuFor === c.id && (
                <div className="chat-history-menu">
                  <button
                    type="button"
                    onClick={() => {
                      const t = window.prompt("Rename chat", c.title);
                      if (t) void renameChat(c.id, t);
                      setMenuFor(null);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => {
                      if (window.confirm(`Delete “${c.title}”?`)) void deleteChat(c.id);
                      setMenuFor(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Conversation ──────────────────────────────────────────── */}
      <main className="chat-main">
        {/* When history is tucked, this is the only way to pull it back out. */}
        {sidebarCollapsed && (
          <button
            type="button"
            className="chat-history-show"
            onClick={toggleSidebar}
            aria-label="Show chat history"
            title="Show history"
          >
            ☰
          </button>
        )}
        {/* Reopen the last document after the panel was closed — the "top-right" the
            chat never had. */}
        {reopenable && (
          <button
            type="button"
            className="chat-reopen"
            onClick={() => openArtifact(reopenable)}
            title={`Reopen ${reopenable.title}`}
          >
            <span aria-hidden>{KIND_ICON[reopenable.kind]}</span>
            <span className="chat-reopen-title">{reopenable.title}</span>
            <span className="chat-reopen-open" aria-hidden>↗</span>
          </button>
        )}
        <div className="chat-messages" ref={scrollRef} onScroll={onScroll}>
          {messages.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-mark">✦</div>
              <div className="chat-empty-title">Ask Paperboy</div>
              <div className="chat-empty-sub">
                I can search the pipeline, your Drive, your inbox and calendar — and make
                changes once you approve them.
              </div>
              <div className="chat-starters">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="chat-starter"
                    onClick={() => void sendMessage(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <Turn
              key={m.id}
              message={m}
              streaming={streaming && i === messages.length - 1}
              onOpenCanvas={setCanvas}
              onDecide={decideProposal}
              onOpenArtifact={openArtifact}
            />
          ))}
          <div ref={endRef} />
        </div>

        {/* ── Composer ────────────────────────────────────────────── */}
        <form className="chat-composer" onSubmit={submit}>
          <textarea
            ref={taRef}
            className="chat-input"
            rows={1}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              autosize();
            }}
            onKeyDown={onKeyDown}
            placeholder="Ask about a deal, your pipeline, your inbox…"
            autoFocus
          />
          {streaming ? (
            <button type="button" className="chat-send is-stop" onClick={stop}>
              Stop
            </button>
          ) : (
            <button type="submit" className="chat-send" disabled={!draft.trim()}>
              Send
            </button>
          )}
        </form>
      </main>

      {artifact ? (
        <>
          <button
            type="button"
            className="chat-resizer"
            aria-label="Resize document panel"
            onPointerDown={startResize}
            onKeyDown={resizeKey}
          />
          <ArtifactPanel
            artifact={artifact}
            onClose={closeArtifact}
            onEdit={editArtifact}
            onExport={exportArtifact}
          />
        </>
      ) : (
        canvas && <Canvas content={canvas} onClose={() => setCanvas(null)} />
      )}
    </div>
  );
}
