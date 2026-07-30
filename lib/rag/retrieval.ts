import Anthropic from "@anthropic-ai/sdk";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { embedText, toVectorLiteral } from "./embeddings";

export interface RetrievedChunk {
  content: string;
  fileName: string;
  title: string | null;
  webLink: string | null;
  driveFileId: string;
  score: number;
}

export interface RetrieveOptions {
  // Drive principals the user satisfies (email, domain:<d>, anyone, group emails).
  principals: string[];
  // Admins bypass the per-file permission filter and see everything.
  isAdmin: boolean;
  // Final number of chunks to return after reranking.
  k?: number;
  // Candidate pool pulled before reranking (per retrieval arm).
  candidates?: number;
}

/**
 * The Drive search itself broke — Vertex rejected the embedding call, credentials
 * are missing, the SQL failed. Thrown rather than swallowed: this used to
 * `return []`, which the caller rendered as "No matching documents found", so a
 * misconfigured index was indistinguishable from an empty one and stayed broken
 * silently. Callers must report a failure as a failure.
 */
export class RetrievalError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "RetrievalError";
  }
}

// Permission-aware hybrid retrieval:
//   1. embed the query (Vertex),
//   2. pull vector + keyword (Postgres FTS) candidates, filtered to files the
//      user may open (accessors overlap; admins bypass),
//   3. fuse the two rankings (Reciprocal Rank Fusion),
//   4. rerank the pool down to k with Claude Haiku.
// Returns [] only for a genuine miss; a broken search throws RetrievalError.
export async function retrieve(
  query: string,
  opts: RetrieveOptions,
): Promise<RetrievedChunk[]> {
  const k = opts.k ?? 8;
  const cand = opts.candidates ?? 30;
  if (!query.trim()) return [];
  if (!opts.isAdmin && opts.principals.length === 0) return [];

  let candidates: RetrievedChunk[];
  try {
    const [queryEmb] = await embedText([query], "RETRIEVAL_QUERY");
    const vec = toVectorLiteral(queryEmb);

    // Fail-closed permission filter. `?|` = "any of these principals appears in
    // the file's accessors array". Requires files to have real `accessors`
    // (captured at ingest) — admins bypass it.
    //
    // sql.param() is load-bearing: interpolating a JS array directly into a sql``
    // template makes Drizzle expand it into a RECORD — `?| ($1,$2,$3)::text[]` —
    // which Postgres rejects with "cannot cast type record to text[]". That threw
    // on every non-admin Drive search, and the old catch-all turned it into
    // "no documents found", so it read as an empty index for months. Bind the whole
    // array as ONE parameter and it arrives as a real text[].
    const acl = opts.isAdmin
      ? sql`TRUE`
      : sql`df.accessors ?| ${sql.param(opts.principals)}::text[]`;

    const result = await db.execute(sql`
      WITH q AS (
        SELECT websearch_to_tsquery('english', ${query}) AS query
      ),
      vec AS (
        SELECT dc.id, dc.content, dc.drive_file_id,
               row_number() OVER (ORDER BY dc.embedding <=> ${vec}::vector) AS rnk
        FROM doc_chunk dc
        JOIN drive_file df ON df.drive_file_id = dc.drive_file_id
        WHERE ${acl}
        ORDER BY dc.embedding <=> ${vec}::vector
        LIMIT ${cand}
      ),
      kw AS (
        SELECT dc.id, dc.content, dc.drive_file_id,
               row_number() OVER (
                 ORDER BY ts_rank(to_tsvector('english', dc.content), q.query) DESC
               ) AS rnk
        FROM doc_chunk dc
        JOIN drive_file df ON df.drive_file_id = dc.drive_file_id
        CROSS JOIN q
        WHERE ${acl}
          AND q.query @@ to_tsvector('english', dc.content)
        ORDER BY ts_rank(to_tsvector('english', dc.content), q.query) DESC
        LIMIT ${cand}
      ),
      fused AS (
        SELECT id, drive_file_id, content, SUM(w) AS score FROM (
          SELECT id, drive_file_id, content, 1.0 / (60 + rnk) AS w FROM vec
          UNION ALL
          SELECT id, drive_file_id, content, 1.0 / (60 + rnk) AS w FROM kw
        ) u
        GROUP BY id, drive_file_id, content
      )
      SELECT f.content,
             df.name        AS file_name,
             df.title       AS title,
             df.web_link    AS web_link,
             f.drive_file_id AS drive_file_id,
             f.score        AS score
      FROM fused f
      JOIN drive_file df ON df.drive_file_id = f.drive_file_id
      ORDER BY f.score DESC
      LIMIT ${cand}
    `);

    const rows =
      (result as unknown as { rows?: Record<string, unknown>[] }).rows ??
      (result as unknown as Record<string, unknown>[]);

    candidates = (rows as Record<string, unknown>[]).map((r) => ({
      content: String(r.content),
      fileName: String(r.file_name),
      title: (r.title as string | null) ?? null,
      webLink: (r.web_link as string | null) ?? null,
      driveFileId: String(r.drive_file_id),
      score: Number(r.score),
    }));
  } catch (err) {
    console.error("[retrieve] search failed:", err);
    throw new RetrievalError((err as Error).message, err);
  }

  return rerank(query, candidates, k);
}

/**
 * Why did a Drive search come back empty? Run only on the zero-result path, to
 * tell "the index was never built" and "the index exists but none of it is shared
 * with you" apart from a genuine miss. All three used to look identical.
 */
export async function diagnoseEmptyResult(opts: {
  principals: string[];
  isAdmin: boolean;
}): Promise<string> {
  try {
    const total = await db.execute(sql`SELECT count(*)::int AS n FROM doc_chunk`);
    const chunks = Number(readCount(total));
    if (chunks === 0) {
      return (
        "The Drive index is EMPTY — no documents have ever been ingested. This is a setup problem, " +
        "not a missing document. Tell the user their Drive has not been synced yet."
      );
    }

    if (!opts.isAdmin) {
      const visible = await db.execute(sql`
        SELECT count(*)::int AS n FROM drive_file df
        WHERE df.accessors ?| ${sql.param(opts.principals)}::text[]
      `);
      if (Number(readCount(visible)) === 0) {
        return (
          `The Drive index holds ${chunks} chunks, but NONE of the files are shared with this user ` +
          `(no file's accessors match). This is a permissions/ingest problem, not a missing document — ` +
          `tell the user their Drive files aren't shared with them in the index.`
        );
      }
    }

    return "No document in the Drive index matched that query.";
  } catch {
    return "No document matched (and the index health check itself failed).";
  }
}

function readCount(result: unknown): number {
  const rows =
    (result as { rows?: Record<string, unknown>[] }).rows ??
    (result as Record<string, unknown>[]);
  return Number((rows as Record<string, unknown>[])[0]?.n ?? 0);
}

// LLM rerank with Claude Haiku — orders candidates by relevance, returns top-k.
// Falls back to fusion order on any error, or when disabled / already small.
async function rerank(
  query: string,
  cands: RetrievedChunk[],
  k: number,
): Promise<RetrievedChunk[]> {
  if (process.env.RAG_RERANK === "off") return cands.slice(0, k);
  if (cands.length <= k) return cands;

  try {
    const client = new Anthropic();
    const pool = cands.slice(0, 24);
    const list = pool
      .map(
        (c, i) => `[${i}] ${c.title ?? c.fileName}\n${c.content.slice(0, 600)}`,
      )
      .join("\n\n");

    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      system:
        "You rank text passages by how well they help answer a query. Return ONLY a JSON array of passage indices, most relevant first. No prose.",
      messages: [
        {
          role: "user",
          content: `Query: ${query}\n\nPassages:\n${list}\n\nReturn the ${k} most relevant passage indices as a JSON array, e.g. [3,0,7].`,
        },
      ],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const match = text.match(/\[[\d,\s]*\]/);
    if (!match) return cands.slice(0, k);

    const order = JSON.parse(match[0]) as number[];
    const picked: RetrievedChunk[] = [];
    const used = new Set<number>();
    for (const idx of order) {
      if (Number.isInteger(idx) && idx >= 0 && idx < pool.length && !used.has(idx)) {
        used.add(idx);
        picked.push(pool[idx]);
      }
      if (picked.length >= k) break;
    }
    // Backfill from fusion order if the model returned fewer than k.
    for (let i = 0; i < cands.length && picked.length < k; i++) {
      const c = cands[i];
      if (!picked.includes(c)) picked.push(c);
    }
    return picked.slice(0, k);
  } catch (err) {
    console.warn("[rerank] failed, using fusion order:", (err as Error).message);
    return cands.slice(0, k);
  }
}
