"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPacer, type Pacer } from "./pacer";
import {
  PENDING_LS_KEY,
  type Chat,
  type ChatMessage,
  type Citation,
  type MessagePart,
  type StreamEvent,
  type Artifact,
} from "./types";

type ProposalStatus = "pending" | "approved" | "denied" | "failed";

function uid(prefix = ""): string {
  return prefix + Date.now() + "-" + Math.random().toString(36).slice(2);
}

function msg(role: ChatMessage["role"], text: string): ChatMessage {
  return { id: uid(), role, text, ts: new Date().toISOString() };
}

export function useChats() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [streaming, setStreaming] = useState(false);

  // The document open in the panel. Lives here rather than in ChatApp because the
  // stream writes into it and the next request must send it back.
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const artifactRef = useRef<Artifact | null>(null);
  artifactRef.current = artifact;

  const hydrated = useRef(false);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;
  const streamingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  /** The user typed into the panel. Their text is the truth from here on. */
  const editArtifact = useCallback((content: string) => {
    setArtifact((a) => (a ? { ...a, content } : a));
  }, []);

  const closeArtifact = useCallback(() => setArtifact(null), []);
  const openArtifact = useCallback((a: Artifact) => setArtifact(a), []);

  // Core send: persists + streams a reply from /api/chat, assembling the agent's
  // ORDERED parts (text / thinking / tool calls / proposals / files).
  const deliver = useCallback(async (text: string, forceNew: boolean) => {
    const t = text.trim();
    if (!t || streamingRef.current) return;
    streamingRef.current = true;
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Hoisted so the error/abort path can kill the frame loop — otherwise it keeps
    // committing paced text into a message the catch block is already replacing.
    let pacer: Pacer<StreamEvent> | null = null;

    try {
      let id = forceNew ? null : activeIdRef.current;
      if (!id) {
        const res = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t.slice(0, 48) }),
        });
        const { chat } = (await res.json()) as { chat: Chat };
        id = chat.id;
        setChats((prev) => [chat, ...prev]);
        setActiveId(id);
        activeIdRef.current = id;
      }
      const chatId = id;

      const asstId = uid();
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                title: c.messages.length === 0 ? t.slice(0, 48) : c.title,
                messages: [
                  ...c.messages,
                  msg("user", t),
                  { id: asstId, role: "assistant", text: "", ts: new Date().toISOString(), parts: [] },
                ],
                updated: new Date().toISOString(),
              }
            : c,
        ),
      );

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          message: t,
          model: "claude",
          // Send the document as the user currently SEES it, including anything they
          // typed. Without this the model edits a stale copy and its find-and-replace
          // silently misses — the surest way to make this feel broken.
          artifact: artifactRef.current
            ? { id: artifactRef.current.id, content: artifactRef.current.content }
            : undefined,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`chat ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      let accText = "";
      let parts: MessagePart[] = [];
      let citations: Citation[] = [];
      let serverId: string | undefined;

      const appendText = (s: string) => {
        const last = parts[parts.length - 1];
        if (last?.kind === "text") last.text += s;
        else parts.push({ kind: "text", text: s });
      };
      const appendThinking = (s: string) => {
        const last = parts[parts.length - 1];
        if (last?.kind === "thinking") last.text += s;
        else parts.push({ kind: "thinking", text: s });
      };

      const commit = () => {
        // Clone parts so React sees new references.
        const snapshot = parts.map((p) => ({ ...p })) as MessagePart[];
        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === asstId
                      ? {
                          ...m,
                          // Swap to the real server id once known, so approvals
                          // can reference this message.
                          id: serverId ?? m.id,
                          text: accText,
                          parts: snapshot,
                          citations: citations.length ? citations : undefined,
                        }
                      : m,
                  ),
                }
              : c,
          ),
        );
      };
      // Reveal text at a smooth, frame-aligned rate instead of mirroring network
      // jitter. Non-text events ride the same queue, so a tool card can never jump
      // ahead of the text that preceded it. See lib/chat/pacer.ts.
      pacer = createPacer<StreamEvent>({
        onText: (slice) => {
          accText += slice;
          appendText(slice);
        },
        onEvent: (ev) => applyEvent(ev),
        onCommit: commit,
      });

      const applyEvent = (ev: StreamEvent) => {
        switch (ev.type) {
          case "text":
            // Never reaches here — text is paced, not applied directly.
            break;
          case "thinking":
            appendThinking(ev.text);
            break;
          case "tool_start":
            parts.push({
              kind: "tool",
              id: ev.id,
              tool: ev.tool,
              label: ev.label,
              input: ev.input,
              done: false,
            });
            break;
          case "tool_end": {
            const p = parts.find((x) => x.kind === "tool" && x.id === ev.id);
            if (p && p.kind === "tool") {
              p.result = { summary: ev.summary, preview: ev.preview, isError: ev.isError };
              p.durationMs = ev.durationMs;
              p.done = true;
            }
            // The saved artifact comes back here with its real version number. This is
            // also the ONLY path for update_artifact — an edit has no body to stream,
            // so the panel swaps to the revised text in one go.
            const saved = (ev.preview as { artifact?: Artifact } | undefined)?.artifact;
            if (saved?.id && typeof saved.content === "string") {
              setArtifact({ ...saved, streaming: false });
            }
            break;
          }
          case "proposal":
            parts.push({
              kind: "proposal",
              id: ev.id,
              action: ev.action,
              params: ev.params,
              summary: ev.summary,
              status: "pending",
            });
            break;
          case "citations":
            citations = ev.citations;
            break;

          // The model has begun writing a document. Open the panel NOW, empty — the
          // body arrives right behind it. Waiting for the finished document is what
          // made this feel like a long silence followed by a magic reveal.
          case "artifact_start":
            setArtifact({
              id: ev.id,
              kind: ev.kind,
              title: ev.title,
              content: "",
              version: 0,
              streaming: true,
            });
            break;

          // Appended, not replaced: the server sends only what's new.
          case "artifact_delta":
            setArtifact((a) => (a ? { ...a, content: a.content + ev.text } : a));
            break;
          case "file":
            parts.push({
              kind: "file",
              fileId: ev.fileId,
              filename: ev.filename,
              mime: ev.mime,
              size: ev.size,
            });
            break;
          case "error":
            accText += `\n\n_${ev.message}_`;
            appendText(`\n\n_${ev.message}_`);
            break;
          case "done":
            serverId = ev.messageId;
            break;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let ev: StreamEvent;
          try {
            ev = JSON.parse(line) as StreamEvent;
          } catch {
            continue;
          }
          if (ev.type === "text") pacer.pushText(ev.text);
          else pacer.pushEvent(ev);
        }
      }

      // The network is done, but the pacer may still be revealing the tail. Wait for
      // it, so the "streaming" state (and the caret) survive until the last character
      // is actually on screen.
      await pacer.finish();

      // Mark any tool still "running" as finished (e.g. the user hit Stop).
      parts = parts.map((p) => (p.kind === "tool" && !p.done ? { ...p, done: true } : p));
      commit();
    } catch (e) {
      const aborted = (e as Error)?.name === "AbortError";
      // On Stop, show everything the model actually sent — that text is real and the
      // user waited for it. On a genuine failure, drop the queue entirely.
      if (aborted) pacer?.flushNow();
      else pacer?.cancel();
      setChats((prev) =>
        prev.map((c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.role === "assistant" && m.text === ""
              ? {
                  ...m,
                  text: aborted
                    ? "_Stopped._"
                    : "Sorry — I couldn't reach the model. Try again.",
                }
              : m,
          ),
        })),
      );
    } finally {
      abortRef.current = null;
      streamingRef.current = false;
      setStreaming(false);
    }
  }, []);

  // Load chats, then consume any pending message handed over by the Ask bar.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    (async () => {
      let loadedChats: Chat[] = [];
      try {
        const res = await fetch("/api/chats");
        if (res.ok) loadedChats = (await res.json()).chats ?? [];
      } catch {
        /* ignore */
      }

      let pending: string | null = null;
      try {
        pending = localStorage.getItem(PENDING_LS_KEY);
        if (pending) localStorage.removeItem(PENDING_LS_KEY);
      } catch {
        /* ignore */
      }

      setChats(loadedChats);
      setLoaded(true);

      if (pending && pending.trim()) {
        await deliver(pending.trim(), true);
      } else if (loadedChats.length) {
        setActiveId(loadedChats[0].id);
      }
    })();
  }, [deliver]);

  const newChat = useCallback(async () => {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) return;
    const { chat } = (await res.json()) as { chat: Chat };
    setChats((prev) => [chat, ...prev]);
    setActiveId(chat.id);
  }, []);

  const selectChat = useCallback((id: string) => setActiveId(id), []);

  const renameChat = useCallback(async (id: string, title: string) => {
    const t = title.trim().slice(0, 80);
    if (!t) return;
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title: t } : c)));
    await fetch(`/api/chats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t }),
    }).catch(() => {});
  }, []);

  const deleteChat = useCallback(
    async (id: string) => {
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (activeIdRef.current === id) setActiveId(null);
      await fetch(`/api/chats/${id}`, { method: "DELETE" }).catch(() => {});
    },
    [],
  );

  // Approve/deny a proposed write. The server re-reads the proposal from its own
  // stored copy, so we only send identifiers.
  const decideProposal = useCallback(
    async (messageId: string, proposalId: string, decision: "approve" | "deny") => {
      const chatId = activeIdRef.current;
      if (!chatId) return;

      const setStatus = (status: ProposalStatus, error?: string) =>
        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId
                      ? {
                          ...m,
                          parts: (m.parts ?? []).map((p) =>
                            p.kind === "proposal" && p.id === proposalId
                              ? { ...p, status, error }
                              : p,
                          ),
                        }
                      : m,
                  ),
                }
              : c,
          ),
        );

      try {
        const res = await fetch("/api/chat/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, messageId, proposalId, decision }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus("failed", data?.error ?? "Failed");
          return;
        }
        setStatus(data.status ?? (decision === "approve" ? "approved" : "denied"), data?.error);
      } catch {
        setStatus("failed", "Network error");
      }
    },
    [],
  );

  const sendMessage = useCallback((text: string) => deliver(text, false), [deliver]);

  const activeChat = chats.find((c) => c.id === activeId) || null;

  return {
    chats,
    activeChat,
    activeId,
    loaded,
    streaming,
    newChat,
    selectChat,
    renameChat,
    deleteChat,
    sendMessage,
    artifact,
    openArtifact,
    editArtifact,
    closeArtifact,
    stop,
    decideProposal,
  };
}
