#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point at a scratch Postgres}"

here="$(cd "$(dirname "$0")" && pwd)"
migration="$here/../../drizzle_v2/0039_reporting_schema.sql"

npx drizzle-kit migrate

for run in 1 2; do
  sed 's/--> statement-breakpoint//' "$migration" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q
done

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$here/reporting-views.check.sql"
