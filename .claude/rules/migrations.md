---
paths:
  - "apps/api/drizzle_v2/**"
  - "apps/ai/*/drizzle/**"
  - "apps/api/src/database/schema/**"
---

# Migrations

- Make every statement safe to re-run (`IF NOT EXISTS` / `IF EXISTS`): dev runs migrations on a fresh DB, prod has state made by hand (hand-built indexes) that conflicts
- Never edit a merged migration; add a new one
- A just-added enum value can't be used in the same migrate batch: `drizzle-kit migrate` runs all pending migrations in one transaction — cast to `::text` instead of using the literal
- A unique index on an existing table needs a dedupe step first, or an abort check that fails with a clear message
- New indexes on existing tables lock writes and `CONCURRENTLY` fails inside the migrate transaction: for a large table build the index by hand with `CREATE INDEX CONCURRENTLY` first and keep `IF NOT EXISTS` in the migration; for a small table add `-- squawk-ignore require-concurrent-index-creation` above the statement (the one SQL comment allowed)
- Breaking schema changes use expand/contract: add a nullable column, backfill, then add the constraint
- Run `npm run lint:migrations --workspace=api` before pushing: Squawk (`apps/api/.squawk.toml`) checks new and changed files in `drizzle_v2/` against `origin/development`, and CI's `migrations` job gates on it
