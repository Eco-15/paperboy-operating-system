// ── Live Calendar search ──────────────────────────────────────────────────────
// Queries the user's real calendar over ANY date range. The `calendar_event`
// mirror only syncs a window around today (and, before this, nothing in the past
// at all), so "when did we meet Acme?" was unanswerable from the table alone.
// Hits are upserted so they become ontology objects with stable IDs.

import { db } from "@/lib/db";
import { calendarEvents } from "@/lib/db/schema";
import { getGoogleClientForUser } from "./user-client";

export interface CalendarHit {
  ontologyId: string | null;
  calendarEventId: string;
  title: string | null;
  description: string | null;
  start: string | null;
  end: string | null;
  location: string | null;
  attendees: Array<{ email: string; name?: string; status?: string }>;
  status: string | null;
  htmlLink: string | null;
}

export type CalendarSearchResult =
  | { ok: true; hits: CalendarHit[] }
  | {
      ok: false;
      code: "not_connected" | "reconnect" | "rate_limited" | "error";
      message: string;
    };

function classify(err: unknown): Extract<CalendarSearchResult, { ok: false }> {
  const e = err as { code?: number; status?: number; message?: string };
  const status = e.status ?? e.code;
  const message = e.message ?? String(err);

  if (status === 401 || /invalid_grant/i.test(message)) {
    return {
      ok: false,
      code: "reconnect",
      message: "The user's Google authorization has expired. They need to reconnect Google.",
    };
  }
  if (status === 403 && /insufficient|scope/i.test(message)) {
    return {
      ok: false,
      code: "reconnect",
      message: "The Google connection is missing the Calendar scope. The user needs to reconnect Google.",
    };
  }
  if (status === 429 || /rateLimit|quota/i.test(message)) {
    return { ok: false, code: "rate_limited", message: "Google rate-limited the request. Try again shortly." };
  }
  return { ok: false, code: "error", message };
}

/**
 * Search the user's live calendar.
 *
 * @param opts.q        Free-text over title/description/attendees/location.
 * @param opts.timeMin  ISO start of the window. May be in the PAST — that's the point.
 * @param opts.timeMax  ISO end of the window.
 */
export async function searchCalendar(
  userId: string,
  opts: { q?: string; timeMin?: string; timeMax?: string; maxResults?: number },
): Promise<CalendarSearchResult> {
  const client = await getGoogleClientForUser(userId);
  if (!client) {
    return {
      ok: false,
      code: "not_connected",
      message:
        "This user has not connected their Google account, so their calendar cannot be searched at all.",
    };
  }

  try {
    const { google } = await import("googleapis");
    const calendar = google.calendar({ version: "v3", auth: client });

    // Default to a wide window centred on today, so an unqualified question like
    // "have I met with Acme?" looks backwards as well as forwards.
    const now = Date.now();
    const timeMin = opts.timeMin ?? new Date(now - 365 * 24 * 3600 * 1000).toISOString();
    const timeMax = opts.timeMax ?? new Date(now + 90 * 24 * 3600 * 1000).toISOString();

    const list = await calendar.events.list({
      calendarId: "primary",
      q: opts.q,
      timeMin,
      timeMax,
      maxResults: Math.min(Math.max(opts.maxResults ?? 25, 1), 100),
      singleEvents: true,
      orderBy: "startTime",
    });

    const hits: CalendarHit[] = [];
    for (const event of list.data.items ?? []) {
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

      const values = {
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
      };

      const [row] = await db
        .insert(calendarEvents)
        .values(values)
        .onConflictDoUpdate({
          target: calendarEvents.calendarEventId,
          set: {
            title: values.title,
            description: values.description,
            start,
            end,
            location: values.location,
            attendees,
            status: values.status,
            htmlLink: values.htmlLink,
            syncedAt: values.syncedAt,
          },
        })
        .returning({ id: calendarEvents.id });

      hits.push({
        ontologyId: row?.id ?? null,
        calendarEventId: event.id,
        title: values.title,
        description: values.description,
        start: start?.toISOString() ?? null,
        end: end?.toISOString() ?? null,
        location: values.location,
        attendees,
        status: values.status,
        htmlLink: values.htmlLink,
      });
    }

    return { ok: true, hits };
  } catch (err) {
    console.error("[calendar-search] failed:", err);
    return classify(err);
  }
}
