---
id: migration-prod-state-safe
paths:
  - 'apps/api/drizzle_v2/*.sql'
  - 'apps/ai/*/drizzle/*.sql'
triggers:
  - '\bADD\s+COLUMN\b'
  - '\bCREATE\s+(?:UNIQUE\s+)?INDEX\b'
  - '\bADD\s+CONSTRAINT\b'
  - '\bCREATE\s+TYPE\b'
  - '\bDROP\s+(?:TABLE|INDEX|COLUMN|TYPE|CONSTRAINT)\b'
  - '\bALTER\s+TYPE\b.*\bADD\s+VALUE\b'
rule: migrations.md
severity_cap: critical
---

## What to verify

Production does not start from an empty database. A migration must still apply when some of its objects already exist there, because earlier fixes were sometimes made by hand, and drizzle-kit applies every pending migration in one transaction, so one failing statement rolls the whole batch back.

## Evidence required

Quote the exact statement. Say which object it creates, drops or alters, and what already existing state would make it fail (the object exists, rows break a new unique index, an enum value is used in the same batch it was added).

## Report only when

- A CREATE or ADD of an index, column, constraint or type has no IF NOT EXISTS guard (or an equivalent existence check) and the object may already exist in production.
- A DROP has no IF EXISTS guard.
- A unique index or constraint is added with no earlier step that removes or reports duplicate rows.
- A value added to an enum is compared or assigned as that enum later in the same migration set, without a cast to text.
- A migration that is already merged is edited instead of fixed by a new one.

## Do not report

- Missing CONCURRENTLY on small tables: migrate runs inside a transaction, where CONCURRENTLY is impossible, and Squawk already covers locking.
- Statements on tables created earlier in the same migration.
- Generated drizzle meta and snapshot files.

## Real bug example

A migration created unique indexes with plain CREATE UNIQUE INDEX. One of them had been made by hand in production earlier. The statement failed with "relation already exists" and the whole batch of migrations rolled back. The fix was IF NOT EXISTS on each statement and DROP INDEX IF EXISTS.

## Looks risky but fine

A migration for case-insensitive unique indexes on users: a DO block first counts rows that differ only by case and aborts with a clear message, then the indexes are created with IF NOT EXISTS and without CONCURRENTLY, because the table is small and the migration runs in a transaction.
