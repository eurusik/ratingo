#!/bin/sh
# Backfill Meta - Every 6 hours (15 minutes offset)
# Enriches shows with TMDB metadata (posters, cast, providers, etc.)

set -e

BASE_URL="${BASE_URL:-http://ratingo-app:3000}"
CRON_SECRET="${CRON_SECRET}"

echo "[$(date -Iseconds)] Starting Meta Backfill..."
echo "Target: $BASE_URL/api/sync/backfill/meta"

# Execute sync and capture response
RESPONSE=$(curl --fail-with-body -sS \
  --retry 3 \
  --retry-connrefused \
  --retry-delay 2 \
  --retry-max-time 60 \
  --max-time 300 \
  -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$BASE_URL/api/sync/backfill/meta") || {
  echo "[$(date -Iseconds)] ❌ FAILED: Curl request failed"
  exit 1
}

# Extract HTTP status and body
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS:")

echo ""
echo "Response (HTTP $HTTP_STATUS):"
echo "$BODY"
echo ""

# Check if response indicates success
if echo "$BODY" | grep -q '"success"[[:space:]]*:[[:space:]]*true'; then
  echo "[$(date -Iseconds)] ✅ Meta Backfill completed successfully"
  exit 0
else
  echo "[$(date -Iseconds)] ❌ Meta Backfill failed - success=false in response"
  exit 1
fi
