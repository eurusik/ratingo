#!/bin/sh
# Shows Full Sync - One-time or manual trigger
# Complete sync cycle for trending shows with all metadata

set -e

BASE_URL="${BASE_URL:-http://ratingo-app:3000}"
CRON_SECRET="${CRON_SECRET}"

echo "[$(date -Iseconds)] Starting Shows Full Sync..."
echo "Target: $BASE_URL/api/sync/trending/full"
echo ""
echo "This will:"
echo "  - Fetch trending shows from Trakt"
echo "  - Create/update show records with ratings and snapshots"
echo "  - OMDb backfill for cards"
echo "  - TMDB meta backfill"
echo "  - Sync calendar airings and prune old ones"
echo ""

# Execute sync and capture response
RESPONSE=$(curl --fail-with-body -sS \
  --retry 3 \
  --retry-connrefused \
  --retry-delay 2 \
  --retry-max-time 60 \
  --max-time 600 \
  -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$BASE_URL/api/sync/trending/full") || {
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
  echo "[$(date -Iseconds)] ✅ Shows Full Sync completed successfully"
  exit 0
else
  echo "[$(date -Iseconds)] ❌ Shows Full Sync failed - success=false in response"
  exit 1
fi
