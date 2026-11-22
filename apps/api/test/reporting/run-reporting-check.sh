#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point at a scratch Postgres}"

here="$(cd "$(dirname "$0")" && pwd)"
migrations_dir="$here/../../drizzle_v2"

npx drizzle-kit migrate

reporting_migrations=$(grep -l 'reporting' "$migrations_dir"/*.sql | sort)

for run in 1 2; do
  for migration in $reporting_migrations; do
    sed 's/--> statement-breakpoint//' "$migration" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q
  done
done

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$here/reporting-views.check.sql"
