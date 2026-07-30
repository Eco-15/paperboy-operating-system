"use client";

import { useCallback, useEffect, useState } from "react";

export default function DriveSync() {
  const [stats, setStats] = useState<{ files: number; chunks: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const r = await fetch("/api/admin/drive/sync");
    if (r.ok) setStats(await r.json());
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function sync() {
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/admin/drive/sync", { method: "POST" });
      const d = await r.json();
      if (d.ok) {
        setResult(
          `Synced ${d.processed} of ${d.totalFiles} files (${d.skipped} unchanged) · ${d.totalChunks} chunks embedded.`,
        );
        loadStats();
      } else {
        setResult(`Error: ${d.error}`);
      }
    } catch {
      setResult("Sync request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tool-panel" style={{ marginTop: 8 }}>
      <div className="tool-panel-title">Knowledge base (Google Drive)</div>
      <div className="tool-sub-line">
        {stats ? `${stats.files} files · ${stats.chunks} chunks indexed` : "Loading…"}
      </div>
      <button
        className="tool-btn tool-btn--solid"
        type="button"
        onClick={sync}
        disabled={busy}
        style={{ marginTop: 10 }}
      >
        {busy ? "Syncing…" : "Sync Drive now"}
      </button>
      {result && (
        <div className="tool-sub-line" style={{ marginTop: 8 }}>
          {result}
        </div>
      )}
    </div>
  );
}
