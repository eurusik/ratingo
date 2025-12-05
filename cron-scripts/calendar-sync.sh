#!/bin/sh
# Calendar Sync - Every 6 hours at :50 (00:50, 06:50, 12:50, 18:50 UTC)
# Syncs upcoming episode air dates from Trakt calendar

set -e

BASE_URL="${BASE_URL:-http://ratingo-app:3000}"
CRON_SECRET="${CRON_SECRET}"

echo "[$(date -Iseconds)] Starting Calendar Sync..."
echo "Target: $BASE_URL/api/sync/calendar/sync"

# Execute sync and capture response
RESPONSE=$(curl --fail-with-body -sS \
  --retry 3 \
  --retry-connrefused \
  --retry-delay 2 \
  --retry-max-time 30 \
  --max-time 120 \
  -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$BASE_URL/api/sync/calendar/sync") || {
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
  echo "[$(date -Iseconds)] вњ… Calendar Sync completed successfully"
  exit 0
else
  echo "[$(date -Iseconds)] вќЊ Calendar Sync failed - success=false in response"
  exit 1
fi
