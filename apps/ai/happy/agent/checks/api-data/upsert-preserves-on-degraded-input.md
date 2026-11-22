---
id: upsert-preserves-on-degraded-input
paths:
  - 'apps/api/src/modules/{ingestion,catalog,stats,trakt,tmdb}/**/{repositories,mappers,adapters}/**'
triggers:
  - '\bonConflictDoUpdate\b'
  - '\.set\('
  - '\?\?\s*0\b'
  - '\bcatch\b'
  - 'return\s+(?:0|\[\])\s*;'
rule: api-modules.md#Upserts
severity_cap: major
---

## What to verify

Sync jobs refresh stored numbers (watchers, ratings, vote counts, ranks) from upstream APIs on a schedule. A stored value that was good yesterday must survive a bad run today. Follow each value from the upstream call to the SQL write and ask what lands in the column when the call fails, times out, is rate limited, or simply omits the field.

## Evidence required

Quote the line that produces the fallback (a catch returning 0 or an empty array, a `?? 0`, a default in a mapper) and the upsert or update that writes it. Name the column that would be overwritten and say which failure causes it.

## Report only when

- A catch block, or a failed response, yields 0, an empty list, or a default, and that value reaches an `onConflictDoUpdate` or `.set(` that replaces an existing column.
- A missing optional field is coerced with `?? 0` (or a column default is substituted for undefined in a batch insert) and the conflict clause then overwrites the stored value with it.
- The result type gives no way to tell "failed" from "genuinely zero", so the caller cannot skip the write.
- The update clause assigns the incoming value directly where a guard such as COALESCE on the excluded row, or skipping the row, would keep the old value.

## Do not report

- Writes that are meant to reset a value, when the code or its name says so.
- An explicit not-found result that writes 0 on purpose, as long as errors take a separate path that skips the write.
- First inserts with no existing row to protect.

## Real bug example

A bulk watchers fetch for Trakt mapped every failure to `watchers: 0`: the not-found branch and the catch for non-transient errors both returned 0. The caller treated 0 as a real count, so one rate-limited or failed run overwrote good watcher counts with zero. The fix returned null for every failure and made the caller skip null. A related stats upsert had the same shape: undefined became the column default 0 in a batch insert, so the COALESCE guard kept 0 and the community rating count was reset on every sync.

## Looks risky but fine

The same adapter later separated three outcomes: a number (including 0) means success, undefined means the item does not exist upstream, and null means a transient error. Not found may write 0 because it is a real answer, while the catch returns null and the caller skips the write.
