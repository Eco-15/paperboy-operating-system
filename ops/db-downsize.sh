#!/usr/bin/env bash
# Move prod off the oversized free-trial instance onto a right-sized one.
#
# WHY A NEW INSTANCE RATHER THAN A RESIZE: Cloud SQL storage cannot be
# decreased ("you can manually increase the storage capacity ... but you cannot
# decrease it"). paperboy-db carries a 100 GB SSD — ~$17/mo of storage alone,
# already over budget before any compute. Shared-core machines are also
# Enterprise-edition only, and paperboy-db is Enterprise PLUS, whose floor is
# 2 vCPU / 16 GB. So the cheap tiers are unreachable in place.
#
#   FROM  ENTERPRISE_PLUS  db-perf-optimized-N-8  8 vCPU/64 GB  100 GB SSD
#   TO    ENTERPRISE       db-f1-micro            1 shared/0.6  10 GB SSD
#
# Run AFTER `gcloud auth login` as events@paperboyventures.com.
# Safe to re-run — creation steps are skipped if they already exist.
#
#   ./ops/db-downsize.sh            # build + load + verify the new instance
#   ./ops/db-downsize.sh --cutover  # ALSO repoint Cloud Run at it
#
# The cutover is deliberately a separate flag: nothing touches the live service
# until the new database has been loaded and its row counts verified against
# the old one. The old instance is never deleted by this script.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=paperboy-operating-system
REGION=us-central1
SERVICE=paperboy-os
ACCOUNT=events@paperboyventures.com

OLD_ID=paperboy-db
NEW_ID=paperboy-db-small
NEW_TIER=db-f1-micro
NEW_DISK=10
DB_NAME=$(grep '^DATABASE_NAME=' .env.local | cut -d= -f2- || echo postgres)
DB_NAME=${DB_NAME:-postgres}
BUCKET="gs://${PROJECT}-db-backups"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DUMP="$BUCKET/migrate-$STAMP.sql.gz"

G="gcloud --project $PROJECT --account $ACCOUNT"
CUTOVER=0
[ "${1:-}" = "--cutover" ] && CUTOVER=1

# ── 0. preflight ────────────────────────────────────────────────────────────
echo "── 0/6 preflight ──"
if ! gcloud auth print-access-token --account "$ACCOUNT" >/dev/null 2>&1; then
  echo "   ✗ $ACCOUNT has no valid token. Run:  gcloud auth login"
  exit 1
fi
SRC_STATE=$($G sql instances describe "$OLD_ID" --format="value(state)")
[ "$SRC_STATE" = "RUNNABLE" ] || { echo "   ✗ source is $SRC_STATE, not RUNNABLE"; exit 1; }
echo "   source $OLD_ID is RUNNABLE; target db name = $DB_NAME"

wait_for_ops() { # Cloud SQL serialises operations; each patch/create starts one.
  local id="$1" n
  while true; do
    n=$($G sql operations list --instance "$id" --filter="status!=DONE" --format="value(name)" 2>/dev/null | wc -l | tr -d ' ')
    [ "$n" = "0" ] && break
    echo "   … waiting for $n in-flight operation(s) on $id"
    sleep 15
  done
}

# ── 1. new instance ─────────────────────────────────────────────────────────
echo "── 1/6 create $NEW_ID ($NEW_TIER, ${NEW_DISK}GB SSD, ENTERPRISE) ──"
if $G sql instances describe "$NEW_ID" >/dev/null 2>&1; then
  echo "   already exists — skipping create"
else
  SRC_VERSION=$($G sql instances describe "$OLD_ID" --format="value(databaseVersion)")
  echo "   matching source version: $SRC_VERSION"
  # If this fails with an unsupported-version error, the fallback is
  # --tier=db-g1-small (1.7 GB RAM, ~$27/mo) — shared-core availability varies
  # by Postgres major version.
  $G sql instances create "$NEW_ID" \
    --database-version="$SRC_VERSION" \
    --edition=enterprise \
    --tier="$NEW_TIER" \
    --region="$REGION" \
    --storage-size="$NEW_DISK" \
    --storage-type=SSD \
    --no-storage-auto-increase \
    --database-flags=cloudsql.iam_authentication=on \
    --backup-start-time=07:00 \
    --retained-backups-count=7 \
    --quiet
fi
wait_for_ops "$NEW_ID"

echo "   setting the postgres password to match .env.local"
PGPASS=$(grep '^DATABASE_URL=' .env.local | sed -E 's|.*://[^:]+:([^@]*)@.*|\1|')
[ -n "$PGPASS" ] || { echo "   ✗ could not read the password out of DATABASE_URL"; exit 1; }
$G sql users set-password postgres --instance "$NEW_ID" --password "$PGPASS" --quiet
wait_for_ops "$NEW_ID"

# ── 2. fresh dump of the source ─────────────────────────────────────────────
echo "── 2/6 dumping $OLD_ID → $DUMP ──"
SA=$($G sql instances describe "$OLD_ID" --format="value(serviceAccountEmailAddress)")
gcloud storage buckets add-iam-policy-binding "$BUCKET" --account "$ACCOUNT" \
  --member="serviceAccount:$SA" --role=roles/storage.objectAdmin --quiet >/dev/null
$G sql export sql "$OLD_ID" "$DUMP" --database="$DB_NAME" --quiet
wait_for_ops "$OLD_ID"

# ── 3. load it into the new instance ────────────────────────────────────────
echo "── 3/6 importing into $NEW_ID ──"
NEW_SA=$($G sql instances describe "$NEW_ID" --format="value(serviceAccountEmailAddress)")
gcloud storage buckets add-iam-policy-binding "$BUCKET" --account "$ACCOUNT" \
  --member="serviceAccount:$NEW_SA" --role=roles/storage.objectViewer --quiet >/dev/null
$G sql import sql "$NEW_ID" "$DUMP" --database="$DB_NAME" --quiet
wait_for_ops "$NEW_ID"

# ── 4. verify the copy ──────────────────────────────────────────────────────
echo "── 4/6 verifying row counts old vs new ──"
counts() { # $1 = instance connection name → prints "table count" lines
  pkill -f cloud-sql-proxy || true
  cloud-sql-proxy --token="$(gcloud auth print-access-token --account "$ACCOUNT")" \
    --port 5432 "$1" >/dev/null 2>&1 &
  local pid=$!
  sleep 5
  DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-) \
  NODE_PATH="$PWD/node_modules" node -e '
    const { Client } = require("pg");
    (async () => {
      const c = new Client({ connectionString: process.env.DATABASE_URL });
      await c.connect();
      const t = ["user","user_preference","brand_app","inquiry","talent","blog_post",
                 "news_item","investor","lp_profile","push_subscription"];
      for (const n of t) {
        try { const r = await c.query(`select count(*)::int c from "${n}"`); console.log(n, r.rows[0].c); }
        catch { console.log(n, "MISSING"); }
      }
      await c.end();
    })().catch(e => { console.error("ERR", e.message); process.exit(1); });'
  kill $pid 2>/dev/null || true
  sleep 1
}
counts "$PROJECT:$REGION:$OLD_ID" > /tmp/counts_old.txt
counts "$PROJECT:$REGION:$NEW_ID" > /tmp/counts_new.txt
if diff -q /tmp/counts_old.txt /tmp/counts_new.txt >/dev/null; then
  echo "   ✓ identical:"
  sed 's/^/     /' /tmp/counts_new.txt
else
  echo "   ✗ MISMATCH — not cutting over. old | new:"
  diff -y /tmp/counts_old.txt /tmp/counts_new.txt | sed 's/^/     /'
  exit 1
fi

# ── 5. protect the new instance ─────────────────────────────────────────────
echo "── 5/6 deletion protection on $NEW_ID ──"
wait_for_ops "$NEW_ID"
$G sql instances patch "$NEW_ID" --deletion-protection --quiet

# ── 6. cutover (only with --cutover) ────────────────────────────────────────
NEW_CONN="$PROJECT:$REGION:$NEW_ID"
if [ "$CUTOVER" = "1" ]; then
  echo "── 6/6 repointing Cloud Run at $NEW_ID ──"
  $G run services update "$SERVICE" --region "$REGION" --quiet \
    --add-cloudsql-instances "$NEW_CONN" \
    --update-env-vars "INSTANCE_CONNECTION_NAME=$NEW_CONN"
  echo "   ✓ live on the new instance"
  cat <<DONE

Verify the app, then when you are satisfied — and NOT before — free the old box:
  gcloud sql instances patch $OLD_ID --no-deletion-protection --project $PROJECT
  gcloud sql instances delete $OLD_ID --project $PROJECT
That deletion is what actually stops the ~\$1,100/mo charge.
DONE
else
  cat <<DONE

── 6/6 cutover NOT run ──
The new instance is built, loaded and verified. To go live:
  ./ops/db-downsize.sh --cutover

Until then Cloud Run is still on $OLD_ID and you are paying for both.
DONE
fi
