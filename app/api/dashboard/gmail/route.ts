import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { gmailMessages, googleCredentials } from "@/lib/db/schema";

// The signed-in user's unread inbox mail, read from the synced DB table.
// Push notifications + periodic sync keep the data fresh.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user has Google connected
  const [cred] = await db
    .select()
    .from(googleCredentials)
    .where(eq(googleCredentials.userId, session.user.id))
    .limit(1);

  if (!cred) {
    return NextResponse.json({ connected: false, messages: [] });
  }

  // Read from DB instead of calling Google API on every load
  const rows = await db
    .select()
    .from(gmailMessages)
    .where(
      and(
        eq(gmailMessages.userId, session.user.id),
        eq(gmailMessages.isRead, false),
      ),
    )
    .orderBy(desc(gmailMessages.date))
    .limit(8);

  const messages = rows.map((r) => {
    const fromRaw = r.from ?? "";
    const from =
      fromRaw
        .replace(/<[^>]*>/, "")
        .replace(/"/g, "")
        .trim() || fromRaw;
    return {
      id: r.gmailId,
      from: from || "(unknown sender)",
      subject: r.subject ?? "",
      snippet: r.snippet ?? "",
      date: r.date?.toISOString() ?? "",
    };
  });

  return NextResponse.json({ connected: true, messages });
}
