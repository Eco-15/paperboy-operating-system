import { db } from "@/lib/db";
import { calendarEvents } from "@/lib/db/schema";
import type { ActionHandler } from "../../types";

export const syncCalendar: ActionHandler = async (_params, ctx) => {
  const userId = ctx.session?.user?.id;
  if (!userId) return { ok: false, error: "No user session" };

  const { getGoogleClientForUser } = await import("@/lib/google/user-client");
  const client = await getGoogleClientForUser(userId);
  if (!client) return { ok: false, error: "Failed to create Google client" };

  const calendar = (await import("googleapis")).google.calendar({ version: "v3", auth: client });

  // Fetch events from now to 30 days out
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const listRes = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: thirtyDays.toISOString(),
    maxResults: 100,
    singleEvents: true,
    orderBy: "startTime",
  });

  const events = listRes.data.items ?? [];
  let synced = 0;

  for (const event of events) {
    if (!event.id) continue;

    const start = event.start?.dateTime
      ? new Date(event.start.dateTime)
      : event.start?.date
        ? new Date(event.start.date)
        : null;

    const end = event.end?.dateTime
      ? new Date(event.end.dateTime)
      : event.end?.date
        ? new Date(event.end.date)
        : null;

    const attendees = (event.attendees ?? []).map((a) => ({
      email: a.email ?? "",
      name: a.displayName ?? undefined,
      status: a.responseStatus ?? undefined,
    }));

    await db
      .insert(calendarEvents)
      .values({
        calendarEventId: event.id,
        userId,
        title: event.summary ?? null,
        description: event.description ?? null,
        start,
        end,
        location: event.location ?? null,
        attendees,
        status: event.status ?? null,
        htmlLink: event.htmlLink ?? null,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: calendarEvents.calendarEventId,
        set: {
          title: event.summary ?? null,
          description: event.description ?? null,
          start,
          end,
          location: event.location ?? null,
          attendees,
          status: event.status ?? null,
          htmlLink: event.htmlLink ?? null,
          syncedAt: new Date(),
        },
      });

    synced++;
  }

  return {
    ok: true,
    data: { synced },
    edits: [{ objectType: "CalendarEvent", objectId: userId, operation: "update" }],
  };
};
