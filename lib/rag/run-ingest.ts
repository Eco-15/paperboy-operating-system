import "dotenv/config";
import { pool } from "../db";
import { ingestSharedDrive } from "./ingest";

// Standalone Drive → pgvector sync. Run locally with `npm run ingest`, or as a
// scheduled Cloud Run Job in production.
async function main() {
  console.log("Syncing Shared Drive into the vector index…");
  const summary = await ingestSharedDrive();

  console.log(
    `Done. ${summary.processed} processed, ${summary.skipped} skipped of ${summary.totalFiles} files; ${summary.totalChunks} chunks embedded.`,
  );

  // "Done." on its own is what let a 204 MB investment memo disappear from the index
  // without anyone noticing. Always print the breakdown, and never let a run that
  // LOST documents exit 0 as though it succeeded.
  const reasons = Object.entries(summary.skippedByReason);
  if (reasons.length) {
    console.log("Skips by reason: " + reasons.map(([r, n]) => `${r}=${n}`).join(", "));
  }
  if (summary.filesWithNoAccessors > 0) {
    console.warn(
      `⚠️  ${summary.filesWithNoAccessors} file(s) have NO accessors — invisible to every non-admin.`,
    );
  }

  await pool.end();

  if (summary.failures.length > 0) {
    console.error(
      `\n❌ ${summary.failures.length} document(s) are NOT searchable. This run did not fully succeed.`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
