#!/usr/bin/env bash
# Everything built for the Jul 22 Kyle meeting, taken live in one run.
# RUN AFTER re-authing (both tokens went stale with invalid_rapt):
#
#   gcloud auth login                       # events@paperboyventures.com
#   gcloud auth application-default login \
#     --scopes=openid,https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/drive.readonly
#
#   ./ops/meeting-prep-go-live.sh
#
# What it does, in order (every step idempotent):
#   1. prod DB: create the events tables (golf module migration) if missing
#   2. seed the Golf Party demo event (skips if the slug exists)
#   3. CRM repair: import priorities/deals from the "Move to Airtable" sheet
#      (dry-run first, then asks before writing)
#   4. ensure INTAKE_WEBHOOK_SECRET is set on the Cloud Run service
#   5. deploy the working tree to Cloud Run
#   6. smoke checks
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=paperboy-operating-system
REGION=us-central1
SERVICE=paperboy-os
INSTANCE=paperboy-operating-system:us-central1:paperboy-db
URL=https://paperboy-os-978447873549.us-central1.run.app

ACCOUNT=$(gcloud config get-value account 2>/dev/null || true)
echo "gcloud account: ${ACCOUNT:-none}"
gcloud auth print-access-token >/dev/null 2>&1 || {
  echo "✗ gcloud token stale — run the two login commands in the header first."; exit 1; }

echo "── 1/6 prod DB: events tables ──"
pkill -f cloud-sql-proxy || true
cloud-sql-proxy --token="$(gcloud auth print-access-token)" --port 5432 "$INSTANCE" &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null || true' EXIT
sleep 3

DB_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)
MIGRATION=$(grep -l 'CREATE TABLE "event_rsvp"' drizzle/*.sql | head -1)
[ -n "$MIGRATION" ] || { echo "✗ no drizzle migration creates event_rsvp — regenerate (npm run db:generate)"; exit 1; }
echo "migration file: $MIGRATION"

DATABASE_URL="$DB_URL" MIGRATION_FILE="$MIGRATION" NODE_PATH="$PWD/node_modules" node - <<'EOF'
const { readFileSync } = require("fs");
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const { rows } = await c.query("select to_regclass('public.event_rsvp') as t");
  if (rows[0].t) {
    console.log("events tables already exist — skipping migration");
  } else {
    const sql = readFileSync(process.env.MIGRATION_FILE, "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      const s = stmt.trim();
      if (s) await c.query(s);
    }
    console.log("events tables created ✓");
  }
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
EOF

echo "── 2/6 seed Golf Party demo data ──"
npx tsx lib/db/seed-golf.ts

echo "── 3/6 CRM priority/deal import (dry run first) ──"
npx tsx scripts/import-deal-priorities.ts || {
  echo "Drive fetch failed — download the 'Move to Airtable' sheet as CSV and rerun:";
  echo "  npx tsx scripts/import-deal-priorities.ts --csv ~/Downloads/move-to-airtable.csv --apply";
  exit 1; }
read -r -p "Apply the import above? [y/N] " yn
if [[ "$yn" =~ ^[Yy]$ ]]; then
  npx tsx scripts/import-deal-priorities.ts --apply
else
  echo "skipped apply — rerun with --apply when ready"
fi

echo "── 4/6 INTAKE_WEBHOOK_SECRET on Cloud Run ──"
INTAKE=$(grep '^INTAKE_WEBHOOK_SECRET=' .env.local | cut -d= -f2- || true)
if [ -z "$INTAKE" ]; then
  INTAKE=$(openssl rand -hex 24)
  printf '\nINTAKE_WEBHOOK_SECRET=%s\n' "$INTAKE" >> .env.local
  echo "generated a new token into .env.local"
fi
gcloud run services update "$SERVICE" --region "$REGION" --project "$PROJECT" \
  --update-env-vars "INTAKE_WEBHOOK_SECRET=$INTAKE" --quiet >/dev/null
echo "intake token set ✓"

echo "── 5/6 deploy to Cloud Run ──"
gcloud run deploy "$SERVICE" --source . --region "$REGION" --project "$PROJECT" --quiet

echo "── 6/6 smoke checks ──"
for path in "/" "/events/golf-party" "/api/mcp"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$URL$path")
  echo "  $path → $code"
done
echo
echo "Done. Demo checklist: /crm (whole book + priorities), a deal page (Brand file panel),"
echo "/events (golf console), $URL/events/golf-party (public RSVP), Claude connector chat."
