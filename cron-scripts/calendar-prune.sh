#!/bin/sh
# Calendar Prune - Every 6 hours at :55 (00:55, 06:55, 12:55, 18:55 UTC)
# Removes old/outdated episode air dates from database

set -e

BASE_URL="${BASE_URL:-http://ratingo-app:3000}"
CRON_SECRET="${CRON_SECRET}"

echo "[$(date -Iseconds)] Starting Calendar Prune..."
echo "Target: $BASE_URL/api/sync/calendar/prune"

# Execute sync and capture response
RESPONSE=$(curl --fail-with-body -sS \
  --retry 3 \
  --retry-connrefused \
  --retry-delay 2 \
  --retry-max-time 30 \
  --max-time 60 \
  -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$BASE_URL/api/sync/calendar/prune") || {
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
  echo "[$(date -Iseconds)] вњ… Calendar Prune completed successfully"
  exit 0
else
  echo "[$(date -Iseconds)] вќЊ Calendar Prune failed - success=false in response"
  exit 1
fi
