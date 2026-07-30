// ── Federated search: "where does this concept live?" ────────────────────────
// The agent used to have to GUESS which of seven surfaces held a thing — ontology,
// Drive, Gmail, Calendar, investors, blog, web — and every wrong guess cost it a
// turn out of a small budget. Asked about "the Invitational", it picked one, missed,
// and reported "not found" while 42 matching emails sat in the database.
//
// This asks every surface the caller is allowed to read, in PARALLEL, in one turn,
// and reports which ones lit up. Each source is independently guarded: a broken
// surface degrades to a labelled error inside the result instead of failing the call
// (which matters — Drive was throwing on every query for months).

import { registry } from "@/lib/ontology/registry";
import { queryObjects } from "@/lib/ontology/query";
import { canRead, type OntologySession } from "@/lib/ontology/auth";
import { retrieve } from "@/lib/rag/retrieval";
import { searchGmail } from "@/lib/google/gmail-search";
import { searchCalendar } from "@/lib/google/calendar-search";

/** Per-type cap — enough to prove presence without flooding the context window. */
const PER_TYPE = 5;

export interface SourceHit {
  source: string;
  /** null when the source errored — an error is NOT the same as "nothing found". */
  count: number | null;
  items?: unknown[];
  error?: string;
}

export interface FederatedResult {
  query: string;
  found: SourceHit[];
  empty: string[];
  failed: SourceHit[];
}

/** Trim an object down to its title + a couple of identifying fields. */
function slim(
  obj: Record<string, unknown>,
  typeDef: { apiName: string; primaryKey: string; titleKey: string },
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    _type: typeDef.apiName,
    id: obj[typeDef.primaryKey],
    title: obj[typeDef.titleKey],
  };
  // Carry a date if the type has one — it's almost always what disambiguates.
  for (const k of ["date", "start", "createdAt", "modifiedTime"]) {
    if (obj[k] != null) {
      out.when = obj[k];
      break;
    }
  }
  return out;
}

export async function searchEverything(
  query: string,
  ctx: {
    session: OntologySession | null;
    principals: string[];
    isAdmin: boolean;
    isStaff: boolean;
    userId: string | null;
  },
): Promise<FederatedResult> {
  const q = query.trim();
  if (!q) {
    return { query, found: [], empty: [], failed: [] };
  }

  const tasks: Array<Promise<SourceHit>> = [];

  // ── Every ontology type the caller may read ────────────────────────────────
  for (const typeDef of Object.values(registry.objectTypes)) {
    if (!canRead(typeDef, ctx.session)) continue;
    tasks.push(
      (async (): Promise<SourceHit> => {
        try {
          const r = await queryObjects(typeDef, {
            filters: {},
            search: q,
            limit: PER_TYPE,
            offset: 0,
            include: [],
            session: ctx.session,
          });
          return {
            source: typeDef.apiName,
            count: r.total,
            items: r.objects.map((o) => slim(o, typeDef)),
          };
        } catch (e) {
          return { source: typeDef.apiName, count: null, error: (e as Error).message };
        }
      })(),
    );
  }

  // ── Staff-only live sources ────────────────────────────────────────────────
  if (ctx.isStaff) {
    tasks.push(
      (async (): Promise<SourceHit> => {
        try {
          const chunks = await retrieve(q, {
            principals: ctx.principals,
            isAdmin: ctx.isAdmin,
            k: 5,
          });
          return {
            source: "Drive",
            count: chunks.length,
            items: chunks.map((c) => ({
              _type: "DriveFile",
              title: c.title ?? c.fileName,
              link: c.webLink,
              excerpt: c.content.slice(0, 300),
            })),
          };
        } catch (e) {
          return { source: "Drive", count: null, error: (e as Error).message };
        }
      })(),
    );

    if (ctx.userId) {
      const uid = ctx.userId;

      tasks.push(
        (async (): Promise<SourceHit> => {
          const r = await searchGmail(uid, q, 5);
          if (!r.ok) return { source: "Gmail", count: null, error: `${r.code}: ${r.message}` };
          return {
            source: "Gmail",
            count: r.estimatedTotal,
            // Metadata only — bodies stay out of the federated summary. The agent
            // calls search_gmail to actually read one.
            items: r.hits.map((h) => ({
              _type: "GmailMessage",
              id: h.ontologyId,
              title: h.subject,
              from: h.from,
              when: h.date,
            })),
          };
        })(),
      );

      tasks.push(
        (async (): Promise<SourceHit> => {
          const r = await searchCalendar(uid, { q, maxResults: 5 });
          if (!r.ok) return { source: "Calendar", count: null, error: `${r.code}: ${r.message}` };
          return {
            source: "Calendar",
            count: r.hits.length,
            items: r.hits.map((h) => ({
              _type: "CalendarEvent",
              id: h.ontologyId,
              title: h.title,
              when: h.start,
            })),
          };
        })(),
      );
    }
  }

  const results = await Promise.all(tasks);

  return {
    query: q,
    found: results.filter((r) => r.count !== null && r.count > 0),
    empty: results.filter((r) => r.count === 0).map((r) => r.source),
    failed: results.filter((r) => r.count === null),
  };
}
