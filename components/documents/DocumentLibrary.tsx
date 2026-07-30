"use client";

import { useCallback, useEffect, useState } from "react";
import Markdown from "@/components/chat/Markdown";
import { KIND_ICON, KIND_LABEL } from "@/lib/chat/artifact-part";
import type { Artifact, ArtifactKind } from "@/lib/chat/types";

// The library row carries `updatedAt`, which the streaming Artifact type doesn't —
// it's a stored-document concern, not a live-panel one.
type LibraryItem = Artifact & { updatedAt: string };

interface Version {
  version: number;
  content: string;
  authoredBy: "assistant" | "user";
  createdAt: string;
}

function when(iso: string | Date): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function DocumentLibrary() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ artifact: Artifact; versions: Version[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/artifacts");
    const d = (await r.json()) as { artifacts?: LibraryItem[] };
    setItems(d.artifacts ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      return;
    }
    void (async () => {
      const r = await fetch(`/api/artifacts?id=${encodeURIComponent(openId)}`);
      if (!r.ok) return setDetail(null);
      setDetail((await r.json()) as { artifact: Artifact; versions: Version[] });
    })();
  }, [openId]);

  const restore = async (version: number) => {
    if (!openId) return;
    setBusy(true);
    await fetch(`/api/artifacts/${encodeURIComponent(openId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restoreVersion: version }),
    });
    const r = await fetch(`/api/artifacts?id=${encodeURIComponent(openId)}`);
    setDetail((await r.json()) as { artifact: Artifact; versions: Version[] });
    await load();
    setBusy(false);
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this document and its version history? This cannot be undone.")) return;
    await fetch(`/api/artifacts/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (openId === id) setOpenId(null);
    await load();
  };

  if (!loaded) return <p className="chat-empty-note">Loading…</p>;

  if (!items.length) {
    return (
      <p className="chat-empty-note">
        No documents yet. Ask Paperboy to draft a memo, deck, model or one-pager — it builds them in the
        panel beside the chat, and they land here.
      </p>
    );
  }

  return (
    <div className="doc-lib">
      <div className="doc-lib-list">
        {items.map((a) => (
          <div key={a.id} className={`doc-lib-row${openId === a.id ? " is-open" : ""}`}>
            <button type="button" className="doc-lib-item" onClick={() => setOpenId(openId === a.id ? null : a.id)}>
              <span className="chat-doc-card-icon" aria-hidden>
                {KIND_ICON[a.kind as ArtifactKind]}
              </span>
              <span className="chat-doc-card-meta">
                <span className="chat-doc-card-title">{a.title}</span>
                <span className="chat-doc-card-sub">
                  {KIND_LABEL[a.kind as ArtifactKind]} · v{a.version} · {when(a.updatedAt)}
                </span>
              </span>
            </button>
            <button type="button" className="doc-lib-del" onClick={() => void remove(a.id)} aria-label="Delete">
              ✕
            </button>
          </div>
        ))}
      </div>

      {detail && (
        <div className="doc-lib-detail">
          <div className="doc-lib-detail-head">
            <div>
              <div className="tool-title">{detail.artifact.title}</div>
              <div className="tool-sub">
                {KIND_LABEL[detail.artifact.kind as ArtifactKind]} · v{detail.artifact.version}
              </div>
            </div>
            <a className="chat-doc-btn chat-doc-btn--ghost" href={`/chat`}>
              Open in chat ↗
            </a>
          </div>

          <div className="doc-lib-versions">
            <div className="chat-sources-label">History</div>
            {detail.versions.map((v) => (
              <div key={v.version} className="doc-lib-ver">
                <span className="doc-lib-ver-n">v{v.version}</span>
                <span className="doc-lib-ver-by">{v.authoredBy === "user" ? "you" : "Paperboy"}</span>
                <span className="doc-lib-ver-at">{when(v.createdAt)}</span>
                {v.version !== detail.artifact.version && (
                  <button
                    type="button"
                    className="doc-lib-restore"
                    disabled={busy}
                    onClick={() => void restore(v.version)}
                  >
                    Restore
                  </button>
                )}
              </div>
            ))}
          </div>

          <article className="chat-doc-body">
            {detail.artifact.kind === "html" ? (
              // Same sandbox rule as the chat panel: scripts yes, same-origin NEVER.
              <iframe
                className="chat-html-frame"
                sandbox="allow-scripts"
                srcDoc={detail.artifact.content}
                title="Preview"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Markdown>{detail.artifact.content}</Markdown>
            )}
          </article>
        </div>
      )}
    </div>
  );
}
