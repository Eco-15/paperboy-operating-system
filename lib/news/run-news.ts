import { config } from "dotenv";
// Local dev keeps secrets in .env.local; in the Cloud Run Job env is injected
// (neither file present → these are harmless no-ops).
config({ path: ".env.local" });
config();
import { pool } from "../db";
import { buildNews, saveNews, todayEdition } from "./build-news";

// Standalone news-loop runner. Run locally with `npm run news`, or as a
// scheduled Cloud Run Job in production (mirrors lib/rag/run-ingest.ts).
async function main() {
  const edition = todayEdition();
  console.log(`[news] building the ${edition} edition…`);
  const items = await buildNews(edition);
  if (items.length === 0) {
    console.log("[news] no stories produced — leaving the current feed as-is.");
    await pool.end();
    return;
  }
  const batchId = crypto.randomUUID();
  await saveNews(items, batchId, edition);
  console.log(`[news] saved ${items.length} stories (batch ${batchId}):`);
  for (const it of items) console.log(`  ${it.rank}. ${it.title} — ${it.source}`);
  await pool.end();
}

main().catch((e) => {
  console.error("[news] failed:", e);
  process.exit(1);
});
