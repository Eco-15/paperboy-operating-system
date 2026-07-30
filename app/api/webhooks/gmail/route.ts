import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { googleCredentials } from "@/lib/db/schema";

// Receives Gmail Pub/Sub push notifications. Google publishes to the topic
// when a user's mailbox changes; the push subscription delivers here.
export async function POST(req: Request) {
  const body = await req.json();
  const data = body.message?.data;
  if (!data) return NextResponse.json({ ok: true });

  // Decode: { emailAddress: "user@domain.com", historyId: "12345" }
  let emailAddress: string | undefined;
  try {
    const decoded = JSON.parse(
      Buffer.from(data, "base64").toString("utf-8"),
    );
    emailAddress = decoded.emailAddress;
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (!emailAddress) return NextResponse.json({ ok: true });

  // Look up which user owns this email
  const [cred] = await db
    .select()
    .from(googleCredentials)
    .where(eq(googleCredentials.email, emailAddress))
    .limit(1);

  if (!cred) return NextResponse.json({ ok: true }); // unknown user

  // Incremental sync; fall back to full sync if history is stale
  try {
    const { incrementalGmailSync } = await import(
      "@/lib/google/gmail-watch"
    );
    const result = await incrementalGmailSync(cred.userId);

    if (result === -1) {
      const { syncGmail } = await import(
        "@/lib/ontology/actions/handlers/sync-gmail"
      );
      await syncGmail({}, { session: { user: { id: cred.userId } } });
    }
  } catch (err) {
    console.error("[webhook/gmail] sync error:", err);
  }

  return NextResponse.json({ ok: true });
}
