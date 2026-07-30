import { NextResponse } from "next/server";

// Receives Google Drive push notifications. Google sends a POST when files
// change on the watched Shared Drive. Triggers a full re-ingest (idempotent).
export async function POST(req: Request) {
  const resourceState = req.headers.get("x-goog-resource-state");
  const token = req.headers.get("x-goog-channel-token");

  // Verify token
  const expected = process.env.SYNC_WEBHOOK_SECRET;
  if (expected && token !== expected) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  // "sync" = initial verification ping
  if (resourceState === "sync") {
    return NextResponse.json({ ok: true });
  }

  // Trigger Drive ingest (idempotent — skips unchanged files by modifiedTime)
  try {
    const { ingestSharedDrive } = await import("@/lib/rag/ingest");
    await ingestSharedDrive();
  } catch (err) {
    console.error("[webhook/drive] ingest error:", err);
  }

  return NextResponse.json({ ok: true });
}
