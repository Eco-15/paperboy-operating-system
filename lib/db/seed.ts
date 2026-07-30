import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db, pool } from "./index";
import { investors, blogPosts, pokerPlayers } from "./schema";
import { DATA } from "../investors/data";
import { SEED_POSTS } from "../blog/seed";
import { parseCsv } from "../poker/parseCsv";

// Seeds reference data so the migrated modules read from Postgres. Idempotent:
// clears each table then re-inserts. Run with `npm run db:seed`.
async function main() {
  // ── Investors ──
  console.log(`Seeding ${DATA.length} investors…`);
  await db.delete(investors);
  const invRows = DATA.map((d) => ({
    type: d.Type,
    groupName: d["Group Name"],
    city: d.City ?? null,
    state: d.State ?? null,
    website: d.Website ?? null,
    linkedin: d.LinkedIn ?? d["LinkedIn "] ?? null,
    summary: d.Summary ?? null,
  }));
  const BATCH = 200;
  for (let i = 0; i < invRows.length; i += BATCH) {
    await db.insert(investors).values(invRows.slice(i, i + BATCH));
  }

  // ── Blog seed posts ──
  console.log(`Seeding ${SEED_POSTS.length} blog posts…`);
  await db.delete(blogPosts);
  await db.insert(blogPosts).values(
    SEED_POSTS.map((p) => ({
      title: p.title,
      category: p.category,
      displayDate: p.date,
      imageUrl: p.image,
      body: p.body,
      // Draft: seed posts are internal placeholders and must not surface on
      // the public /press pages (which render published rows from this table).
      status: "draft",
    })),
  );

  // ── Poker players (baseline votes from the CSV) ──
  try {
    const csv = readFileSync(join(process.cwd(), "public/vote-tally.csv"), "utf8");
    const rows = parseCsv(csv);
    console.log(`Seeding ${rows.length} poker players…`);
    await db.delete(pokerPlayers);
    if (rows.length) {
      await db.insert(pokerPlayers).values(
        rows.map((r) => ({
          name: r.name,
          company: r.company,
          baseVotes: r.votes,
        })),
      );
    }
  } catch (e) {
    console.warn("Skipped poker seed (vote-tally.csv not found?):", e);
  }

  console.log("Done.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
