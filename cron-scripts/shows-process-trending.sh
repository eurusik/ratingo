#!/bin/sh
# Shows Process Trending - Every 6 hours (2 minutes after coordinator)
# Processes batches of trending shows tasks

set -e

BASE_URL="${BASE_URL:-http://ratingo-app:3000}"
CRON_SECRET="${CRON_SECRET}"
LIMIT="${LIMIT:-15}"
INTERVAL_SEC="${INTERVAL_SEC:-15}"

echo "[$(date -Iseconds)] Starting Shows Process Trending..."
echo "Config: limit=$LIMIT interval=${INTERVAL_SEC}s"
echo "Target: $BASE_URL/api/sync/trending/process"
echo ""

while true; do
  # Check status
  echo "[$(date -Iseconds)] Checking status..."
  STATUS_JSON=$(curl --fail-with-body -sS \
    --retry 3 \
    --retry-connrefused \
    --retry-delay 2 \
    --retry-max-time 30 \
    --max-time 20 \
    -H "Authorization: Bearer $CRON_SECRET" \
    "$BASE_URL/api/sync/trending/status") || {
    echo "[$(date -Iseconds)] вќЊ Status request failed"
    exit 1
  }
  
  # Parse pending count
  PENDING=$(echo "$STATUS_JSON" | grep -o '"pending"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$' || echo "0")
  
  echo "[$(date -Iseconds)] Pending tasks: $PENDING"
  
  if [ "$PENDING" -le 0 ]; then
    echo "[$(date -Iseconds)] вњ… No pending tasks - process completed successfully"
    exit 0
  fi
  
  # Process batch
  echo "[$(date -Iseconds)] Processing batch (limit=$LIMIT)..."
  PROCESS_RESPONSE=$(curl --fail-with-body -sS \
    --retry 3 \
    --retry-connrefused \
    --retry-delay 2 \
    --retry-max-time 45 \
    --max-time 20 \
    -w "\nHTTP_STATUS:%{http_code}" \
    -H "Authorization: Bearer $CRON_SECRET" \
    "$BASE_URL/api/sync/trending/process?limit=$LIMIT") || {
    echo "[$(date -Iseconds)] вљ пёЏ  Process request failed, continuing..."
  }
  
  # Show process response
  if [ -n "$PROCESS_RESPONSE" ]; then
    PROCESS_BODY=$(echo "$PROCESS_RESPONSE" | grep -v "HTTP_STATUS:" || echo "$PROCESS_RESPONSE")
    echo "Process response: $PROCESS_BODY"
  fi
  
  echo "[$(date -Iseconds)] Sleeping ${INTERVAL_SEC}s before next batch..."
  sleep "$INTERVAL_SEC"
done
