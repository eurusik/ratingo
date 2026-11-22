---
id: read-then-write-race
paths:
  - 'apps/api/src/modules/**/{application,infrastructure}/**'
triggers:
  - '\.constraint\b'
  - '\bconstraint_name\b'
  - '\bcount\('
  - '\.select\('
  - '\b23505\b|UNIQUE_VIOLATION'
rule: api-modules.md#Races
severity_cap: major
---

## What to verify

The API serves concurrent requests and BullMQ runs several jobs at once, so any check made by one query and acted on by a later query can be passed by two callers together. Find the check, find the write that depends on it, and ask what the database does if two callers interleave between them.

## Evidence required

Quote the read (select, find, count) and the write that relies on it, and describe the interleaving in one sentence: both callers read the same state, both write. For a retry on a unique violation, quote the field the code inspects.

## Report only when

- A select or count decides whether to insert, update, or reject, and nothing makes the pair atomic: no unique index with conflict handling, no transaction with a row lock, no single conditional UPDATE.
- A limit or quota is enforced by counting rows and then inserting.
- Code detects a unique violation by reading `constraint` on the error. postgres.js exposes the constraint as `constraint_name`, so the comparison is never true and the retry path silently never runs, which leaves the job failing forever.
- A state transition reads the current state, validates it in application code, then writes unconditionally.

## Do not report

- Reads followed by writes on data only one worker owns, or a job that is already serialized by its job id.
- A check that is only an optimization, where the database constraint is the real guard.
- Read-only flows with no later write.

## Real bug example

A media upsert retried with a longer slug when it hit the unique slug index. The handler read the constraint from `err.constraint` and `err.cause.constraint`, but postgres.js sets `constraint_name`, so the comparison failed, the handler returned null, the original error was rethrown, and BullMQ retried the job again and again. The fix read `constraint_name` and moved the error code and constraint into shared constants. A later fix for pausing shows replaced a find-then-upsert with one conditional update inside a transaction that locks the row.

## Looks risky but fine

An insert that can lose a race on the slug index catches the unique violation by its code and `constraint_name`, then selects the winning row by slug. If the winner has the same tmdb id, it returns that row. If a different tmdb id owns the slug, it retries once with a unique slug. The database constraint is the guard, and the select afterwards only resolves a conflict that has already happened.
