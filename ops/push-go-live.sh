#!/usr/bin/env bash
# Take the CRM rework live: sortable columns, the "new responses" tray, the
# CRM-only phone app, year-long sessions, and lock-screen push notifications
# for new brand applications.
#
# Run AFTER `gcloud auth login` (account: events@paperboyventures.com).
# Safe to re-run — every step is idempotent.
#
#   ./ops/push-go-live.sh
#
# What it does, in order:
#   1. prod DB: crm_seen_at (0022) + push_subscription (0023)
#   2. Cloud Run env: VAPID keys + the poll secret
#   3. deploy the working tree to Cloud Run
#   4. Cloud Scheduler job polling the szn sheet every 10 minutes
#   5. one live poll, to prove the wiring
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=paperboy-operating-system
REGION=us-central1
SERVICE=paperboy-os
INSTANCE=paperboy-operating-system:us-central1:paperboy-db
URL=https://paperboy-os-978447873549.us-central1.run.app
JOB=paperboy-crm-poll

# Secrets come from .env.local (gitignored) so nothing lands in shell history.
env_val() { grep "^$1=" .env.local | cut -d= -f2-; }
VAPID_PUBLIC_KEY=$(env_val VAPID_PUBLIC_KEY)
VAPID_PRIVATE_KEY=$(env_val VAPID_PRIVATE_KEY)
VAPID_SUBJECT=$(env_val VAPID_SUBJECT)
CRM_POLL_SECRET=$(env_val CRM_POLL_SECRET)
for v in VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT CRM_POLL_SECRET; do
  [ -n "${!v}" ] || { echo "$v missing from .env.local"; exit 1; }
done

echo "── 1/5 prod DB: CRM watermark + push subscriptions ──"
pkill -f cloud-sql-proxy || true
cloud-sql-proxy --token="$(gcloud auth print-access-token --account events@paperboyventures.com)" --port 5432 "$INSTANCE" &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null || true' EXIT
sleep 4

DATABASE_URL=$(env_val DATABASE_URL) \
NODE_PATH="$PWD/node_modules" node - <<'EOF'
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // 0022 — per-user "new responses since you last looked" watermark.
  await c.query(`ALTER TABLE "user_preference" ADD COLUMN IF NOT EXISTS "crm_seen_at" timestamp`);

  // 0023 — one row per device registered for lock-screen notifications.
  await c.query(`CREATE TABLE IF NOT EXISTS "push_subscription" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "endpoint" text NOT NULL,
    "p256dh" text NOT NULL,
    "auth" text NOT NULL,
    "user_agent" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "last_sent_at" timestamp,
    CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint"))`);
  await c.query(`DO $$ BEGIN
    ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  await c.query(`CREATE INDEX IF NOT EXISTS "push_sub_user_idx" ON "push_subscription" ("user_id")`);

  for (const [t, col] of [["user_preference", "crm_seen_at"], ["push_subscription", "endpoint"]]) {
    const r = await c.query(
      `select 1 from information_schema.columns where table_name=$1 and column_name=$2`, [t, col]);
    if (!r.rows.length) throw new Error(`${t}.${col} did not land`);
  }
  console.log("   ✓ crm_seen_at + push_subscription present");
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
EOF

echo "── 2/5 Cloud Run env: VAPID + poll secret ──"
# VAPID_PUBLIC_KEY deliberately has no NEXT_PUBLIC_ prefix: those are inlined at
# build time, and this image is built before these vars are set.
gcloud --account events@paperboyventures.com run services update "$SERVICE" --project "$PROJECT" --region "$REGION" --quiet \
  --update-env-vars "VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY=$VAPID_PRIVATE_KEY,VAPID_SUBJECT=$VAPID_SUBJECT,CRM_POLL_SECRET=$CRM_POLL_SECRET"

echo "── 3/5 deploying to Cloud Run ──"
gcloud --account events@paperboyventures.com run deploy "$SERVICE" --source . --region "$REGION" --project "$PROJECT" --quiet

echo "── 4/5 Cloud Scheduler: poll the sheet every 10 minutes ──"
gcloud --account events@paperboyventures.com services enable cloudscheduler.googleapis.com --project "$PROJECT" --quiet
gcloud --account events@paperboyventures.com scheduler jobs delete "$JOB" --project "$PROJECT" --location "$REGION" --quiet 2>/dev/null || true
gcloud --account events@paperboyventures.com scheduler jobs create http "$JOB" \
  --project "$PROJECT" --location "$REGION" \
  --schedule "*/10 * * * *" --time-zone "America/New_York" \
  --uri "$URL/api/admin/crm/poll" --http-method POST \
  --headers "x-crm-secret=$CRM_POLL_SECRET" \
  --attempt-deadline 300s

echo "── 5/5 first poll ──"
curl -sf -X POST -H "x-crm-secret: $CRM_POLL_SECRET" "$URL/api/admin/crm/poll" --max-time 300
echo

cat <<'DONE'

Live. To finish on your phone:
  1. Open the app from your home screen (reinstall if it isn't there:
     open /m in Safari → Share → Add to Home Screen).
  2. Tap the person icon → "Notify me about new deals".
  3. Accept the iOS prompt — a confirmation notification arrives immediately.

New applications are picked up within 10 minutes of hitting the sheet.
DONE
