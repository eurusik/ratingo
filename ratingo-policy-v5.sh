#!/usr/bin/env bash
set -euo pipefail

: "${API_BASE:?Need API_BASE like https://api.ratingo.top/api}"
: "${RATINGO_TOKEN:?Need RATINGO_TOKEN}"

auth_header=("Authorization: Bearer ${RATINGO_TOKEN}")
json_header=("Content-Type: application/json")

tmpdir="$(mktemp -d)"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

api_post_json() {
  local url="$1"
  local payload="$2"
  local body_file
  local headers_file
  body_file="$(mktemp "$tmpdir/body.XXXXXX")"
  headers_file="$(mktemp "$tmpdir/headers.XXXXXX")"

  local http_code
  http_code=$(curl -sS "$url" \
    -H "${auth_header[@]}" -H "${json_header[@]}" \
    -d "$payload" \
    -D "$headers_file" \
    -o "$body_file" \
    -w '%{http_code}')

  export LAST_HTTP_CODE="$http_code"
  export LAST_URL="$url"
  export LAST_HEADERS_FILE="$headers_file"
  export LAST_BODY_FILE="$body_file"

  if [[ -z "${http_code}" ]]; then
    echo "ERROR: No HTTP status code returned from $url" >&2
    echo "--- response body ---" >&2
    cat "$body_file" >&2 || true
    exit 1
  fi

  if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
    echo "ERROR: HTTP $http_code from $url" >&2
    echo "--- response body ---" >&2
    cat "$body_file" >&2 || true
    exit 1
  fi

  cat "$body_file"
}

print_json_or_body() {
  python3 -c "import os,sys,json
raw=sys.stdin.read()
if not raw.strip():
  http_code=os.environ.get('LAST_HTTP_CODE','?')
  url=os.environ.get('LAST_URL','?')
  print(f'ERROR: Empty response body (HTTP {http_code}) from {url}')
  body_file=os.environ.get('LAST_BODY_FILE')
  if body_file:
    try:
      st=os.stat(body_file)
      print(f'Body file: {body_file} ({st.st_size} bytes)')
      if st.st_size>0:
        with open(body_file,'rb') as f:
          sample=f.read(200)
        print('--- body sample (first 200 bytes) ---')
        sys.stdout.buffer.write(sample)
        print('\\n--- end sample ---')
    except Exception:
      pass
  headers_file=os.environ.get('LAST_HEADERS_FILE')
  if headers_file:
    try:
      with open(headers_file,'r',encoding='utf-8',errors='replace') as f:
        headers=f.read().strip()
      if headers:
        print('--- response headers ---')
        print(headers)
    except Exception:
      pass
  sys.exit(1)

try:
  j=json.loads(raw)
except Exception:
  print('ERROR: Response is not valid JSON. Body:')
  print(raw)
  sys.exit(1)

summary=(j.get('data') or {}).get('summary')
if summary is None:
  summary=j.get('summary', j)
print(json.dumps(summary, ensure_ascii=False, indent=2))
"
}

debug_last_body_file() {
  echo "DEBUG: LAST_BODY_FILE=$LAST_BODY_FILE"
  if [[ -f "$LAST_BODY_FILE" ]]; then
    wc -c "$LAST_BODY_FILE" || true
    echo "--- first 200 bytes (cat -v) ---"
    head -c 200 "$LAST_BODY_FILE" | cat -v || true
    echo
    echo "--- end ---"
  else
    echo "DEBUG: body file not found" >&2
  fi
}

policy_json='{
  "allowedCountries":["US","UA","GB","CA","AU","DE","FR","ES","IT","NL","SE","PL"],
  "blockedCountries":["JP","KR","CN","IN","TR","ID"],
  "blockedCountryMode":"ANY",
  "allowedLanguages":["en","uk","de","fr","es","it","pl"],
  "blockedLanguages":["ja","ko","zh","hi","tr","id","ar"],
  "globalProviders":["netflix","prime_video","disney_plus","apple_tv_plus","max","paramount_plus","hulu","peacock"],
  "breakoutRules":[
    {"id":"early-viral","name":"Early Viral","priority":1,"requirements":{"minImdbVotes":8000,"minQualityScoreNormalized":0.62}},
    {"id":"viral-hit","name":"Viral Hit","priority":2,"requirements":{"minImdbVotes":100000,"minQualityScoreNormalized":0.55}},
    {"id":"streaming-original","name":"Streaming Original","priority":3,"requirements":{"minImdbVotes":3000,"requireAnyOfProviders":["netflix","prime_video","disney_plus","apple_tv_plus","max"]}},
    {"id":"critically-acclaimed","name":"Critically Acclaimed","priority":4,"requirements":{"minQualityScoreNormalized":0.74,"requireAnyOfRatingsPresent":["imdb","metacritic","rt"]}},
    {"id":"top-foreign","name":"Top Foreign","priority":5,"requirements":{"minQualityScoreNormalized":0.65,"requireAnyOfRatingsPresent":["imdb","trakt"],"minImdbVotes":10000,"minTraktVotes":10000}}
  ],
  "eligibilityMode":"STRICT",
  "homepage":{"minRelevanceScore":35},
  "globalRequirements":{
    "appliesTo":["catalog","homepage","trending","search"],
    "minQualityScoreNormalized":0.58,
    "minVotesAnyOf":{"sources":["imdb","trakt"],"min":1500},
    "requireAnyOfRatingsPresent":["imdb","trakt","metacritic","rt"]
  },
  "excludedContentClasses":[],
  "contextRequirements":{
    "trending":{"requireReadableTitle":true,"requireOverview":true,"minOverviewChars":60},
    "homepage":{"requireReadableTitle":true,"requireOverview":true,"minOverviewChars":60},
    "catalog":{"requireReadableTitle":true},
    "search":{"requireReadableTitle":true}
  }
}'

echo "== 1) Dry-run diff (sample 5000) =="

dry_run_payload=$(python3 - <<PY
import json
policy = json.loads("""$policy_json""")
print(json.dumps({"policy": policy, "options": {"mode":"sample","limit":5000}}))
PY
)

api_post_json "$API_BASE/admin/catalog-policies/dry-run/diff" "$dry_run_payload" >/dev/null

cat "$LAST_BODY_FILE" | print_json_or_body

echo
read -r -p "Continue to CREATE DRAFT + PREPARE? (y/N) " ans
if [[ "${ans:-}" != "y" && "${ans:-}" != "Y" ]]; then
  echo "Stopped after dry-run."
  exit 0
fi

echo "== 2) Create draft policy =="
api_post_json "$API_BASE/admin/catalog-policies" "$policy_json" >/dev/null
create_resp=$(cat "$LAST_BODY_FILE")

echo "$create_resp" | python3 -c "import sys,json
raw=sys.stdin.read()
j=json.loads(raw) if raw.strip() else {}
data=(j.get('data') if isinstance(j,dict) else None) or j
print('createPolicy response:', data)
"

policy_id=$(echo "$create_resp" | python3 -c "import sys,json
raw=sys.stdin.read()
j=json.loads(raw) if raw.strip() else {}
data=(j.get('data') if isinstance(j,dict) else None) or j
print(data.get('id',''))
" )

if [[ -z "$policy_id" ]]; then
  echo "ERROR: Could not extract policy id from create response" >&2
  echo "$create_resp" >&2
  exit 1
fi

echo "Policy ID: $policy_id"

echo "== 3) Prepare policy (start run) =="
api_post_json "$API_BASE/admin/catalog-policies/$policy_id/prepare" "{}" >/dev/null
prepare_resp=$(cat "$LAST_BODY_FILE")

echo "$prepare_resp"

run_id=$(echo "$prepare_resp" | python3 -c "import sys,json
raw=sys.stdin.read()
j=json.loads(raw) if raw.strip() else {}
data=(j.get('data') if isinstance(j,dict) else None) or j
print(data.get('runId',''))
" )

if [[ -z "$run_id" ]]; then
  echo "ERROR: Could not extract runId from prepare response" >&2
  echo "$prepare_resp" >&2
  exit 1
fi

echo "Run ID: $run_id"

echo "== 4) Poll run status until prepared/finished =="
for i in {1..60}; do
  status_resp=$(curl -sS "$API_BASE/admin/catalog-policies/runs/$run_id" \
    -H "${auth_header[@]}" \
    -o "$tmpdir/status.json" \
    -w '%{http_code}')
  status_body=$(cat "$tmpdir/status.json" || true)
  if [[ "$status_resp" -lt 200 || "$status_resp" -ge 300 ]]; then
    echo "ERROR: HTTP $status_resp while polling run status" >&2
    echo "--- response body ---" >&2
    echo "$status_body" >&2
    exit 1
  fi
  status=$(echo "$status_body" | python3 -c "import sys,json
raw=sys.stdin.read()
j=json.loads(raw) if raw.strip() else {}
data=(j.get('data') if isinstance(j,dict) else None) or j
print(data.get('status',''))
" )
  processed=$(echo "$status_body" | python3 -c "import sys,json
raw=sys.stdin.read()
j=json.loads(raw) if raw.strip() else {}
data=(j.get('data') if isinstance(j,dict) else None) or j
p=data.get('progress',{}) or {}
print(f\"{p.get('processed')}/{p.get('total')} eligible={p.get('eligible')} ineligible={p.get('ineligible')} pending={p.get('pending')}\")
" )
  echo "[$i] status=$status progress=$processed"
  if [[ "$status" == "prepared" || "$status" == "finished" ]]; then
    break
  fi
  sleep 5
done

echo
read -r -p "Promote run now? (y/N) " ans2
if [[ "${ans2:-}" != "y" && "${ans2:-}" != "Y" ]]; then
  echo "Not promoted. Run is at: $run_id"
  exit 0
fi

echo "== 5) Promote run =="
api_post_json "$API_BASE/admin/catalog-policies/runs/$run_id/promote" "{}" >/dev/null
promote_resp=$(cat "$LAST_BODY_FILE")

echo "$promote_resp"
echo "DONE."
