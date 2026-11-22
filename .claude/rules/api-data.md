---
paths:
  - "apps/api/**"
---

# Data Correctness Rules (from fix history)

## Upserts
- Never overwrite a good stored value with `0`, `null`, `[]` or a default because the upstream response was partial or failed (13 past fixes, e.g. a Trakt failure writing `watchers: 0`)
- Adapters return `null` for "unknown", never `0`/`[]`
- In upserts use `COALESCE(excluded.x, t.x)` or build the `set` object only from defined fields

## BullMQ jobs
- `jobId` includes the media type (`tmdbId` is unique only per type) and never contains `:`
- Every queue sets `removeOnComplete` and `removeOnFail` (unbounded retention once filled Redis with 43k jobs)
- Type job payloads with `satisfies <JobData>` so renamed fields (`offset` vs `afterId`) fail at compile time
- Claim the work (state transition or lock) before the external side effect, so a retry cannot repeat it

## Races
- No read-then-write without a transaction, `FOR UPDATE`, or a conditional `WHERE state IN (...)` on the update
- Counters update atomically in SQL (`x = x + 1`), never read, add, write
- On unique violations read `constraint_name` from the postgres.js error (it has no `constraint`)

## External HTTP
- Call external APIs only through `ResilientHttpClient` (`common/http`)
- Trakt calls go through the shared limiter (`TRAKT_RATE_LIMIT_PORT`)
- Keep "not found" distinct from "error": a 404 is a result, a failure must not be stored as absence
- Don't call providers for unreleased titles

## Query scoping
- Look up by `tmdbId` together with the media type
- Joins to `media_catalog_evaluations` filter the active `policy_version`
- Never chain two `.where()` calls on a Drizzle query — the second replaces the first; combine with `and(...)`
- Paginated `orderBy` ends with a unique tiebreaker (id)
- Respect the table's soft-delete column in every read

## Dates
- A null or undated air/release date is never "aired"; reuse `user-media/domain/policies/episode-airing.policy.ts` and `computeReleaseStatus` (`catalog/domain/utils/release-status.utils.ts`)
- Range bounds use the UTC day start, not `new Date()`
- `updated_at` is bookkeeping, not business time — don't use it for "when did this happen" logic
- Cron entries carry `tz`

## DTO input
- Boolean query params need an explicit `@Transform` — implicit conversion turns `"false"` into `true`
- Clients never set server-owned flags; omit them from request DTOs
- Zod policy schemas and class-validator DTOs describe the same fields — change both together
- Bound numeric and array params (`@Min`/`@Max`, `@ArrayMaxSize`)
