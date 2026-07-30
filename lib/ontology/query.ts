// ── Ontology Query Engine ─────────────────────────────────────────────────────
// Translates ontology-level queries into Drizzle ORM calls. This is the heart
// of the read path — all object type reads funnel through here.

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { and, or, eq, ilike, desc, asc, sql, type SQL } from "drizzle-orm";
import { brandAppToDeal, inquiryToDeal } from "@/lib/crm/map";
import { registry } from "./registry";
import type { ObjectTypeDef, PropertyDef, QueryOpts, QueryResult } from "./types";

/**
 * A caller (usually the AI agent) asked for something this object type can't do —
 * an unknown property, an unsortable key. Thrown rather than ignored: the agent's
 * executor catches it and hands the message back to the model, which corrects
 * itself and retries. Silently dropping the clause instead would return the first
 * N *unfiltered* rows, which the model then reports on as though it had searched.
 */
export class OntologyQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OntologyQueryError";
  }
}

/** The property names the agent is actually shown, for use in error messages. */
function validProps(typeDef: ObjectTypeDef): string {
  return Object.entries(typeDef.properties)
    .filter(([, p]) => p.visible !== false)
    .map(([k]) => k)
    .join(", ");
}

/** Property types we can run an ILIKE against, per the ontology. */
function isTextual(p: PropertyDef): boolean {
  return (
    (p.type === "string" || p.type === "text" || p.type === "email" || p.type === "url") &&
    p.visible !== false &&
    !p.computed
  );
}

// The ontology calls a uuid PK a "string", but Postgres has no `uuid ILIKE text`
// operator — including one in the search OR makes the whole query throw. Trust the
// column's real type, not the ontology's label.
const ILIKE_SAFE = new Set(["PgText", "PgVarchar", "PgChar"]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ilikeable(col: any): boolean {
  return !!col && ILIKE_SAFE.has(col.columnType);
}

// ── Table registry: maps object type apiName → Drizzle table + optional mapper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleTable = Parameters<typeof db.select<any>>[0] extends infer _T ? any : never;
type TableEntry = {
  // Using `any` for the table reference since schema exports include PgEnum and
  // other non-table values that break strict typing on `db.select().from()`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  mapper?: (row: any) => Record<string, unknown>;
};

const tableRegistry: Record<string, TableEntry> = {
  User:          { table: schema.users },
  Investor:      { table: schema.investors },
  BlogPost:      { table: schema.blogPosts },
  PokerPlayer:   { table: schema.pokerPlayers },
  NewsItem:      { table: schema.newsItems },
  Subscriber:    { table: schema.subscribers },
  DriveFile:     { table: schema.driveFiles },
  Chat:          { table: schema.chats },
  Contact:       { table: schema.inquiries },
  Invite:        { table: schema.invites },
  GmailMessage:  { table: schema.gmailMessages },
  CalendarEvent: { table: schema.calendarEvents },
};

// Object types that hold per-user private data. Reads MUST be scoped to the
// signed-in user's `userId`, and MUST fail CLOSED (return nothing) when there is
// no authenticated user — otherwise one staff member could read another's inbox,
// calendar, or chats. Enforced in both queryObjects (list) and getObjectById.
const OWNER_SCOPED = new Set(["Chat", "GmailMessage", "CalendarEvent"]);

// ── Union type queries (Deal = brandApps ∪ inquiries) ────────────────────────

function ts(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

async function queryDeals(typeDef: ObjectTypeDef, opts: QueryOpts): Promise<QueryResult> {
  const [apps, forms] = await Promise.all([
    db.select().from(schema.brandApps),
    db.select().from(schema.inquiries),
  ]);

  let deals = [
    ...forms.map(inquiryToDeal),
    ...apps.map(brandAppToDeal),
  ] as Record<string, unknown>[];

  // Apply filters
  for (const [key, value] of Object.entries(opts.filters)) {
    if (!(key in typeDef.properties)) {
      throw new OntologyQueryError(
        `Unknown property '${key}' on Deal. Valid properties: ${validProps(typeDef)}.`,
      );
    }
    deals = deals.filter((d) => {
      const v = d[key];
      if (v == null) return false;
      if (typeof v === "string") return v.toLowerCase().includes(value.toLowerCase());
      return String(v) === value;
    });
  }

  // Free-text: match against any string value on the deal.
  const term = opts.search?.trim().toLowerCase();
  if (term) {
    deals = deals.filter((d) =>
      Object.values(d).some(
        (v) => typeof v === "string" && v.toLowerCase().includes(term),
      ),
    );
  }

  // Sort
  const total = deals.length;
  const sortSpec = opts.sort ?? typeDef.defaultSort ?? null;
  if (sortSpec) {
    const descending = sortSpec.startsWith("-");
    const sortKey = descending ? sortSpec.slice(1) : sortSpec;
    deals.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = String(av).localeCompare(String(bv));
      return descending ? -cmp : cmp;
    });
  } else {
    // Default: newest first by date
    deals.sort((a, b) => ts(b.date as string) - ts(a.date as string));
  }

  // Paginate
  deals = deals.slice(opts.offset, opts.offset + opts.limit);

  return { objectType: "Deal", objects: deals, total };
}

// Map of union types to their custom query functions
const unionQueries: Record<
  string,
  (typeDef: ObjectTypeDef, opts: QueryOpts) => Promise<QueryResult>
> = {
  Deal: queryDeals,
};

// ── Column name mapping ──────────────────────────────────────────────────────
// Drizzle tables use camelCase JS keys that map to snake_case SQL columns.
// We resolve columns by accessing the Drizzle table object directly.

function getColumn(table: any, key: string): any {
  // Drizzle table objects have property access for each column
  return table[key] ?? null;
}

// ── Core query function ──────────────────────────────────────────────────────

export async function queryObjects(
  typeDef: ObjectTypeDef,
  opts: QueryOpts,
): Promise<QueryResult> {
  // Union type? Use custom query.
  if (unionQueries[typeDef.apiName]) {
    return unionQueries[typeDef.apiName](typeDef, opts);
  }

  const entry = tableRegistry[typeDef.apiName];
  if (!entry) {
    throw new Error(`No table mapping for ${typeDef.apiName}`);
  }

  const { table, mapper } = entry;

  // Build WHERE conditions from filters
  const conditions: SQL[] = [];
  for (const [key, value] of Object.entries(opts.filters)) {
    const col = getColumn(table, key);
    if (!col) {
      throw new OntologyQueryError(
        `Unknown property '${key}' on ${typeDef.apiName}. Valid properties: ${validProps(typeDef)}. ` +
          `To match text across several properties at once, use the 'search' parameter instead.`,
      );
    }

    const propDef = typeDef.properties[key];
    if (propDef?.type === "json") {
      // JSONB array containment via PostgreSQL @> operator.
      // Attendees is an array of {email, name, status} objects — match by email.
      if (key === "attendees") {
        conditions.push(sql`${col} @> ${JSON.stringify([{ email: value }])}::jsonb`);
      } else {
        conditions.push(sql`${col} @> ${JSON.stringify([value])}::jsonb`);
      }
    } else if (propDef?.type === "string" || propDef?.type === "text") {
      conditions.push(ilike(col, `%${value}%`));
    } else if (propDef?.type === "boolean") {
      conditions.push(eq(col, value === "true"));
    } else {
      conditions.push(eq(col, value));
    }
  }

  // Free-text search across every textual property of the type.
  if (opts.search?.trim()) {
    const term = `%${opts.search.trim()}%`;
    const cols = Object.entries(typeDef.properties)
      .filter(([k, p]) => k !== typeDef.primaryKey && isTextual(p))
      .map(([k]) => getColumn(table, k))
      .filter(ilikeable);
    if (!cols.length) {
      throw new OntologyQueryError(
        `${typeDef.apiName} has no text-searchable properties — use 'filters' instead.`,
      );
    }
    // SAFETY: this OR is pushed as ONE element of `conditions`, which is and()-ed
    // together below — so it sits *alongside* the ownership predicate, never
    // beside it in the same or(). or(searchCond, ownerCond) would match other
    // users' rows whenever the text matched: a cross-user inbox leak. `search`
    // must only ever narrow the result set.
    conditions.push(or(...cols.map((c) => ilike(c, term)))!);
  }

  // Ownership filter (fail closed): users only ever see their own private data.
  // With no authenticated user, force an empty result rather than leaking all rows.
  if (OWNER_SCOPED.has(typeDef.apiName)) {
    const userCol = getColumn(table, "userId");
    const uid = opts.session?.user?.id;
    if (userCol && uid) {
      conditions.push(eq(userCol, uid));
    } else if (userCol) {
      conditions.push(sql`1 = 0`);
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Build ORDER BY. Every query gets a deterministic order: without one, the
  // `offset` we hand the agent silently repeats and skips rows between pages.
  const orderBy: SQL[] = [];
  const sortSpec = opts.sort ?? typeDef.defaultSort ?? null;
  if (sortSpec) {
    const descending = sortSpec.startsWith("-");
    const sortKey = descending ? sortSpec.slice(1) : sortSpec;
    const col = getColumn(table, sortKey);
    if (col) {
      orderBy.push(descending ? desc(col) : asc(col));
    } else if (opts.sort) {
      // An unknown sort from the caller is a mistake worth reporting; a bad
      // `defaultSort` is our own bug, so fall through to the tiebreaker.
      throw new OntologyQueryError(
        `Cannot sort ${typeDef.apiName} by '${sortKey}' — no such property. Valid properties: ${validProps(typeDef)}.`,
      );
    }
  } else {
    const createdCol = getColumn(table, "createdAt");
    if (createdCol) orderBy.push(desc(createdCol));
  }
  const pkCol = getColumn(table, typeDef.primaryKey);
  if (pkCol) orderBy.push(asc(pkCol));

  // Execute count query (for total)
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(where);
  const total = countResult[0]?.count ?? 0;

  // Execute data query
  let query = db.select().from(table).where(where).limit(opts.limit).offset(opts.offset);
  if (orderBy.length) {
    query = query.orderBy(...orderBy) as typeof query;
  }

  const rows = await query;
  const objects: Record<string, unknown>[] = mapper ? rows.map(mapper) : rows;

  // Resolve linked objects via `include` parameter
  if (opts.include.length > 0) {
    for (const obj of objects) {
      for (const linkName of opts.include) {
        const linkDef = registry.linkTypes[linkName];
        if (!linkDef || linkDef.from !== typeDef.apiName || !linkDef.foreignKey) continue;
        const fkValue = obj[linkDef.foreignKey];
        if (!fkValue) continue;
        const targetType = registry.objectTypes[linkDef.to];
        if (!targetType) continue;
        const linked = await getObjectById(targetType, String(fkValue), {
          session: opts.session,
        });
        if (linked) (obj as Record<string, unknown>)[`_${linkName}`] = linked;
      }
    }
  }

  return { objectType: typeDef.apiName, objects, total };
}

// ── Single object by ID ──────────────────────────────────────────────────────

export async function getObjectById(
  typeDef: ObjectTypeDef,
  id: string,
  opts?: { session?: QueryOpts["session"] },
): Promise<Record<string, unknown> | null> {
  // Union type: find in either table
  if (typeDef.apiName === "Deal") {
    const [apps, forms] = await Promise.all([
      db.select().from(schema.brandApps).where(eq(schema.brandApps.id, id)),
      db.select().from(schema.inquiries).where(eq(schema.inquiries.id, id)),
    ]);
    if (apps.length) return brandAppToDeal(apps[0]);
    if (forms.length) return inquiryToDeal(forms[0]) as Record<string, unknown>;
    return null;
  }

  const entry = tableRegistry[typeDef.apiName];
  if (!entry) return null;

  const { table, mapper } = entry;
  const pkCol = getColumn(table, typeDef.primaryKey);
  if (!pkCol) return null;

  const rows = await db.select().from(table).where(eq(pkCol, id)).limit(1);
  if (!rows.length) return null;

  // Ownership check (fail closed): a per-user private object is only returned to
  // its owner. Without this, the /[objectType]/[id] route (gated only to staff)
  // would let any staff member read another user's email/calendar/chat by ID.
  if (OWNER_SCOPED.has(typeDef.apiName)) {
    const uid = opts?.session?.user?.id;
    if (!uid || (rows[0] as { userId?: string }).userId !== uid) return null;
  }

  return mapper ? mapper(rows[0]) : rows[0];
}

// ── Register new table mappings (for Gmail/Calendar after migration) ─────────

export function registerTable(apiName: string, entry: TableEntry) {
  tableRegistry[apiName] = entry;
}
