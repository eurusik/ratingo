#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_REPOSITORY:?}" "${GITHUB_OUTPUT:?}" "${PR_NUMBER:?}" "${BASE_SHA:?}"
wait_seconds=${PREVIEW_WAIT_SECONDS:-900}
poll_seconds=${PREVIEW_POLL_SECONDS:-15}
deadline=$(( $(date +%s) + wait_seconds ))

preview_status() {
  local deployment_id
  deployment_id=$(gh api "repos/$GITHUB_REPOSITORY/deployments?sha=$1&environment=Preview&per_page=1" --jq '.[0].id // empty')
  [[ -z "$deployment_id" ]] && return 0
  gh api "repos/$GITHUB_REPOSITORY/deployments/$deployment_id/statuses?per_page=1" \
    --jq '.[0] | select(.) | "\(.state) \(.environment_url // "")"'
}

newest_first_candidate_shas() {
  gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER/commits?per_page=100" --jq '[.[].sha] | reverse | .[]'
  echo "$BASE_SHA"
}

resolve_preview() {
  local sha state url
  for sha in $(newest_first_candidate_shas); do
    read -r state url <<< "$(preview_status "$sha")" || true
    case "${state:-}" in
      success)
        [[ -n "${url:-}" ]] && echo "ready $sha $url" || echo "failed $sha success-without-url"
        return
        ;;
      inactive) ;;
      failure | error)
        echo "failed $sha $state"
        return
        ;;
      *)
        echo "pending $sha ${state:-not-created-yet}"
        return
        ;;
    esac
  done
  echo "failed none no-built-preview"
}

echo "Waiting for the Vercel preview of PR #$PR_NUMBER (commits skipped by Vercel fall back to older ones)"
while (( $(date +%s) < deadline )); do
  read -r outcome sha detail <<< "$(resolve_preview)" || true
  case "${outcome:-}" in
    ready)
      echo "Preview of $sha ready: $detail"
      echo "url=$detail" >> "$GITHUB_OUTPUT"
      exit 0
      ;;
    failed)
      echo "::error::No usable Vercel preview (commit $sha: $detail)"
      exit 1
      ;;
  esac
  echo "  ${sha:-?}: ${detail:-unknown}"
  sleep "$poll_seconds"
done

echo "::error::No ready Vercel preview for PR #$PR_NUMBER after ${wait_seconds}s"
exit 1
