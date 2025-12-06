#!/bin/sh
# Backfill OMDb - Every 6 hours at :40 (00:40, 06:40, 12:40, 18:40 UTC)
# Enriches shows with IMDb ratings and Metacritic scores from OMDb

set -e

BASE_URL="${BASE_URL:-http://ratingo-app:3000}"
CRON_SECRET="${CRON_SECRET}"

echo "[$(date -Iseconds)] Starting OMDb Backfill..."
echo "Target: $BASE_URL/api/sync/backfill/omdb"

# Execute sync and capture response
RESPONSE=$(curl --fail-with-body -sS \
  --retry 3 \
  --retry-connrefused \
  --retry-delay 2 \
  --retry-max-time 60 \
  --max-time 300 \
  -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$BASE_URL/api/sync/backfill/omdb") || {
  echo "[$(date -Iseconds)] вќЊ FAILED: Curl request failed"
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
  echo "[$(date -Iseconds)] вњ… OMDb Backfill completed successfully"
  exit 0
else
  echo "[$(date -Iseconds)] вќЊ OMDb Backfill failed - success=false in response"
  exit 1
fi
