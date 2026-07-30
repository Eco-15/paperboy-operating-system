#!/usr/bin/env bash
# Bring the prod database back to a safe, supported state after the Cloud SQL
# free trial expired and suspended it (2026-07-30).
#
# RUN THIS ONLY AFTER the instance has been upgraded off the free trial in the
# Cloud Console — every Admin API call (patch / restart / export / clone) is
# rejected with 409 invalidState while it is SUSPENDED, so this script cannot
# do that step for you. It checks and refuses to run if the instance isn't up.
#
#   ./ops/db-restore.sh
#
# Safe to re-run — every step is idempotent.
#
# What it does, in order:
#   1. refuse unless the instance is RUNNABLE
#   2. deletion protection ON  (it was OFF, with no backups — never again)
#   3. automated daily backups + point-in-time recovery ON
#   4. full SQL dump to GCS, so a copy exists outside Cloud SQL
#   5. apply the pending crm_seen_at column (migration 0022)
#   6. report table row counts so we can see the data actually survived
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=paperboy-operating-system
REGION=us-central1
INSTANCE_ID=paperboy-db
INSTANCE="$PROJECT:$REGION:$INSTANCE_ID"
BUCKET="gs://${PROJECT}-db-backups"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

# Cloud SQL serialises instance operations: while one is RUNNING, the next
# mutating call fails with "another operation was already in progress" (409).
# Each patch below starts one, and the post-upgrade UPDATE can still be
# running when this script starts — so wait between every mutating step.
wait_for_ops() {
  local n
  while true; do
    n=$(gcloud sql operations list --instance "$INSTANCE_ID" --project "$PROJECT" \
          --filter="status!=DONE" --format="value(name)" 2>/dev/null | wc -l | tr -d ' ')
    [ "$n" = "0" ] && break
    echo "   … waiting for $n in-flight operation(s)"
    sleep 15
  done
}

echo "── 1/6 checking instance state ──"
# SUSPENDED is terminal for us (only the Console can lift it). MAINTENANCE and
# PENDING_CREATE are transient — the trial upgrade parks the instance there for
# a while — so wait them out rather than treating them as failure.
DEADLINE=$(( $(date +%s) + 3600 ))
while true; do
  STATE=$(gcloud sql instances describe "$INSTANCE_ID" --project "$PROJECT" --format="value(state)")
  case "$STATE" in
    RUNNABLE)
      echo "   state = RUNNABLE"
      break
      ;;
    SUSPENDED)
      cat <<MSG

   ✗ The instance is SUSPENDED — the free trial has not been upgraded yet. Open:
     https://console.cloud.google.com/sql/instances/$INSTANCE_ID/overview?project=$PROJECT
   and use the upgrade/activate action in the banner. The Admin API cannot do
   it — patch, restart, export and clone all return 409 while suspended.

MSG
      exit 1
      ;;
    MAINTENANCE|PENDING_CREATE|*)
      if [ "$(date +%s)" -ge "$DEADLINE" ]; then
        echo "   ✗ still $STATE after an hour — investigate before retrying."
        exit 1
      fi
      echo "   state = $STATE — transient, waiting…"
      sleep 30
      ;;
  esac
done

wait_for_ops
echo "── 2/6 deletion protection ──"
gcloud sql instances patch "$INSTANCE_ID" --project "$PROJECT" --deletion-protection --quiet

wait_for_ops
echo "── 3/6 automated backups + point-in-time recovery ──"
# --backup-start-time implies --backup. PITR needs WAL retention; 7 days is
# plenty and keeps the storage cost negligible at this data size.
gcloud sql instances patch "$INSTANCE_ID" --project "$PROJECT" \
  --backup-start-time=07:00 \
  --enable-point-in-time-recovery \
  --retained-transaction-log-days=7 \
  --retained-backups-count=15 \
  --quiet

wait_for_ops
echo "── 4/6 exporting a full dump to $BUCKET ──"
gcloud storage buckets describe "$BUCKET" --project "$PROJECT" >/dev/null 2>&1 || \
  gcloud storage buckets create "$BUCKET" --project "$PROJECT" --location "$REGION" \
    --uniform-bucket-level-access
# The export is performed BY the instance's own service account, so it needs
# write access to the bucket.
SA=$(gcloud sql instances describe "$INSTANCE_ID" --project "$PROJECT" \
      --format="value(serviceAccountEmailAddress)")
gcloud storage buckets add-iam-policy-binding "$BUCKET" \
  --member="serviceAccount:$SA" --role=roles/storage.objectAdmin --quiet >/dev/null
DUMP="$BUCKET/paperboy-$STAMP.sql.gz"
gcloud sql export sql "$INSTANCE_ID" "$DUMP" --database=postgres --project "$PROJECT" --quiet
echo "   ✓ dumped to $DUMP"

echo "── 5/6 applying the pending schema (0022: user_preference.crm_seen_at) ──"
pkill -f cloud-sql-proxy || true
cloud-sql-proxy --token="$(gcloud auth print-access-token)" --port 5432 "$INSTANCE" &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null || true' EXIT
sleep 4

DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-) \
NODE_PATH="$PWD/node_modules" node - <<'EOF'
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // 0022 — the CRM's per-user "new responses since you last looked" watermark.
  await c.query(`ALTER TABLE "user_preference" ADD COLUMN IF NOT EXISTS "crm_seen_at" timestamp`);
  const col = await c.query(
    `select data_type, is_nullable from information_schema.columns
      where table_name='user_preference' and column_name='crm_seen_at'`);
  if (!col.rows.length) throw new Error("crm_seen_at did not land");
  console.log(`   ✓ user_preference.crm_seen_at (${col.rows[0].data_type}, nullable=${col.rows[0].is_nullable})`);

  // 6/6 — prove the data survived the suspension.
  console.log("── 6/6 row counts ──");
  for (const t of ["user", "user_preference", "brand_app", "inquiry", "talent",
                   "blog_post", "news_item", "investor", "lp_profile"]) {
    try {
      const r = await c.query(`select count(*)::int as n from "${t}"`);
      console.log(`   ${t.padEnd(18)} ${r.rows[0].n}`);
    } catch {
      console.log(`   ${t.padEnd(18)} (missing)`);
    }
  }
  await c.end();
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
EOF

cat <<'DONE'

Done. The database is protected, backed up, and carries the CRM schema.

Still to do, deliberately NOT automated here:
  • right-size the instance (it is ENTERPRISE_PLUS / db-perf-optimized-N-8 —
    ~8x more machine than this app needs). Do it now that a dump exists.
  • deploy the CRM work:
    gcloud run deploy paperboy-os --source . --region us-central1 \
      --project paperboy-operating-system
DONE
