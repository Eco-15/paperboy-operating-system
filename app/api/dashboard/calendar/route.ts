import { NextResponse } from "next/server";
import { eq, and, gte, asc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { calendarEvents, googleCredentials } from "@/lib/db/schema";

// The signed-in user's upcoming events, read from the synced DB table.
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
    return NextResponse.json({ connected: false, events: [] });
  }

  // Read from DB instead of calling Google API on every load
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.userId, session.user.id),
        gte(calendarEvents.start, new Date()),
      ),
    )
    .orderBy(asc(calendarEvents.start))
    .limit(8);

  const events = rows
    .filter((r) => r.status !== "cancelled")
    .map((r) => ({
      id: r.calendarEventId,
      title: r.title ?? "(no title)",
      start: r.start?.toISOString() ?? "",
      allDay: false,
      location: r.location ?? null,
    }));

  return NextResponse.json({ connected: true, events });
}
