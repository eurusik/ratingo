#!/bin/sh
# Movies Full Sync - Daily at 03:00 UTC
# Syncs top 100 trending movies with all metadata

set -e

BASE_URL="${BASE_URL:-http://ratingo-app:3000}"
CRON_SECRET="${CRON_SECRET}"

echo "[$(date -Iseconds)] Starting Movies Full Sync..."
echo "Target: $BASE_URL/api/sync/movies/trending/full"

# Execute sync and capture response
RESPONSE=$(curl --fail-with-body -sS \
  --retry 3 \
  --retry-connrefused \
  --retry-delay 2 \
  --retry-max-time 60 \
  --max-time 300 \
  -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$BASE_URL/api/sync/movies/trending/full") || {
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
  echo "[$(date -Iseconds)] вњ… Movies Full Sync completed successfully"
  exit 0
else
  echo "[$(date -Iseconds)] вќЊ Movies Full Sync failed - success=false in response"
  exit 1
fi
