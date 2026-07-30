"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Staff-only manual trigger for the news loop (same endpoint Cloud Scheduler
// hits daily). Rebuilds today's edition, then refreshes the page.
export default function RefreshNewsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function refresh() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/news/refresh", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="tool-btn" onClick={refresh} disabled={busy}>
      {busy ? "Fetching today’s stories…" : error ? "Failed — try again" : "Refresh today’s edition"}
    </button>
  );
}
