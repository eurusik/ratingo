#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_REPOSITORY:?}" "${GITHUB_OUTPUT:?}" "${PREVIEW_SHA:?}"
deadline=$(( $(date +%s) + ${PREVIEW_WAIT_SECONDS:-900} ))
poll_seconds=${PREVIEW_POLL_SECONDS:-15}

latest_preview_status() {
  local deployment_id
  deployment_id=$(gh api "repos/$GITHUB_REPOSITORY/deployments?sha=$PREVIEW_SHA&environment=Preview&per_page=1" --jq '.[0].id // empty')
  [[ -z "$deployment_id" ]] && return 0
  gh api "repos/$GITHUB_REPOSITORY/deployments/$deployment_id/statuses?per_page=1" \
    --jq '.[0] | select(.) | "\(.state) \(.environment_url // "")"'
}

echo "Waiting for the Vercel preview of $PREVIEW_SHA"
while (( $(date +%s) < deadline )); do
  read -r state url <<< "$(latest_preview_status)" || true
  case "${state:-}" in
    success)
      if [[ -z "${url:-}" ]]; then
        echo "::error::Vercel preview for $PREVIEW_SHA succeeded without an environment URL"
        exit 1
      fi
      echo "Preview ready: $url"
      echo "url=$url" >> "$GITHUB_OUTPUT"
      exit 0
      ;;
    failure | error | inactive)
      echo "::error::Vercel preview deployment for $PREVIEW_SHA ended '$state'"
      exit 1
      ;;
  esac
  echo "  status: ${state:-not created yet}"
  sleep "$poll_seconds"
done

echo "::error::No ready Vercel preview for $PREVIEW_SHA after ${PREVIEW_WAIT_SECONDS:-900}s"
exit 1
