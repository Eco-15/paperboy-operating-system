#!/usr/bin/env bash
# Take the daily CPG news loop live, end to end. Run AFTER `gcloud auth login`
# (account: events@paperboyventures.com). Safe to re-run — every step is
# idempotent (IF NOT EXISTS columns, upsert-style scheduler job).
#
#   ./ops/news-go-live.sh
#
# What it does, in order:
#   1. prod DB: apply the pending schema (0015 marketing + 0016 news `edition`)
#      through a fresh cloud-sql-proxy
#   2. ensure EXA_API_KEY + NEWS_REFRESH_SECRET are set on the Cloud Run service
#   3. deploy the working tree to Cloud Run
#   4. create (or update) the 6am ET daily Cloud Scheduler job
#   5. trigger the first run and print today's edition
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=paperboy-operating-system
REGION=us-central1
SERVICE=paperboy-os
INSTANCE=paperboy-operating-system:us-central1:paperboy-db
URL=https://paperboy-os-978447873549.us-central1.run.app
JOB=paperboy-news-daily

# Secrets come from .env.local (gitignored) so nothing lands in shell history.
EXA_API_KEY=$(grep '^EXA_API_KEY=' .env.local | cut -d= -f2-)
NEWS_REFRESH_SECRET=$(grep '^NEWS_REFRESH_SECRET=' .env.local | cut -d= -f2-)
[ -n "$EXA_API_KEY" ] || { echo "EXA_API_KEY missing from .env.local"; exit 1; }
[ -n "$NEWS_REFRESH_SECRET" ] || { echo "NEWS_REFRESH_SECRET missing from .env.local"; exit 1; }

echo "── 1/5 prod DB: applying news + marketing columns ──"
pkill -f cloud-sql-proxy || true
cloud-sql-proxy --token="$(gcloud auth print-access-token)" --port 5432 "$INSTANCE" &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null || true' EXIT
sleep 3

DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-) \
NODE_PATH="$PWD/node_modules" node - <<'EOF'
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  // 0016 — news editions
  await c.query(`ALTER TABLE "news_item" ADD COLUMN IF NOT EXISTS "edition" text DEFAULT '' NOT NULL`);
  // 0015 — marketing rebuild (subscriber lists + job submissions), idempotent
  await c.query(`DO $$ BEGIN
    CREATE TYPE "public"."subscriber_list" AS ENUM('deals','jobs','talent');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  await c.query(`CREATE TABLE IF NOT EXISTS "job_submission" (
    "id" text PRIMARY KEY NOT NULL, "company" text NOT NULL,
    "contact_email" text NOT NULL, "role_title" text NOT NULL,
    "link" text, "notes" text, "created_at" timestamp DEFAULT now() NOT NULL)`);
  await c.query(`ALTER TABLE "subscriber" DROP CONSTRAINT IF EXISTS "subscriber_email_unique"`);
  await c.query(`ALTER TABLE "subscriber" ADD COLUMN IF NOT EXISTS "list" "subscriber_list" DEFAULT 'deals' NOT NULL`);
  await c.query(`ALTER TABLE "subscriber" ADD COLUMN IF NOT EXISTS "name" text`);
  await c.query(`ALTER TABLE "subscriber" ADD COLUMN IF NOT EXISTS "note" text`);
  await c.query(`CREATE UNIQUE INDEX IF NOT EXISTS "subscriber_email_list_idx" ON "subscriber" USING btree ("email","list")`);
  const r = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='news_item' AND column_name='edition'`);
  if (!r.rows.length) throw new Error("edition column did not land");
  console.log("   ✓ schema up to date (news_item.edition present)");
  await c.end();
})().catch((e) => { console.error(e); process.exit(1); });
EOF

echo "── 2/5 Cloud Run env: EXA_API_KEY + NEWS_REFRESH_SECRET ──"
gcloud run services update "$SERVICE" --project "$PROJECT" --region "$REGION" \
  --update-env-vars "EXA_API_KEY=$EXA_API_KEY,NEWS_REFRESH_SECRET=$NEWS_REFRESH_SECRET" --quiet

echo "── 3/5 deploying to Cloud Run ──"
gcloud run deploy "$SERVICE" --source . --region "$REGION" --project "$PROJECT" --quiet

echo "── 4/5 daily Cloud Scheduler job (6:00am ET) ──"
gcloud services enable cloudscheduler.googleapis.com --project "$PROJECT" --quiet
gcloud scheduler jobs delete "$JOB" --project "$PROJECT" --location "$REGION" --quiet 2>/dev/null || true
gcloud scheduler jobs create http "$JOB" \
  --project "$PROJECT" --location "$REGION" \
  --schedule "0 6 * * *" --time-zone "America/New_York" \
  --uri "$URL/api/admin/news/refresh" --http-method POST \
  --headers "x-news-secret=$NEWS_REFRESH_SECRET" \
  --attempt-deadline 480s

echo "── 5/5 publishing the first edition ──"
curl -sf -X POST -H "x-news-secret: $NEWS_REFRESH_SECRET" "$URL/api/admin/news/refresh"
echo
echo "Done — open $URL/news"
