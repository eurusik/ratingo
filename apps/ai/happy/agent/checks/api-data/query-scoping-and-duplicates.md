---
id: query-scoping-and-duplicates
paths:
  - 'apps/api/src/modules/**/infrastructure/{queries,repositories}/**'
triggers:
  - 'media_catalog_evaluations|mediaCatalogEvaluations'
  - '\.where\('
  - '\btmdbId\b'
  - 'orderBy'
  - 'deletedAt|isDeleted'
rule: api-modules.md#Query scoping
severity_cap: major
---

## What to verify

Public listings and detail queries join several tables that have more than one row per media item, and several keys that are unique only in combination. Check that each query returns one row per item, stays inside the right media type, applies every filter, hides deleted rows, and pages in a stable order.

## Evidence required

Quote the join, filter or order clause at fault. State the extra rows or wrong rows it produces (a second evaluation version, a movie and a show with the same tmdb id, a soft-deleted item) or the pagination symptom (repeated or skipped rows between pages).

## Report only when

- `media_catalog_evaluations` is joined by media item id alone. Its key is the media item plus the policy version, so the join must also match the active policy version, otherwise every extra version duplicates the row and inflates counts.
- A lookup or update uses `tmdbId` without the media type. The id is unique only per type, so a movie and a show can share it.
- A second `.where(` is chained on the same query. Drizzle keeps only the last one and drops the earlier filter.
- A public query does not filter out soft-deleted rows (`deletedAt`) while its sibling queries do.
- A paginated query orders by a column that is not unique (score, rank, date) with no unique tie-breaker such as the id.

## Do not report

- Admin or internal queries that intentionally include deleted or all versions.
- Queries that already filter by type, such as a shows-only query.
- Ordering by a unique column, or a tie-breaker that is already present.
- Count queries that correctly share the same joins as the list.

## Real bug example

Listings, trending, hero and details queries inner joined the evaluations table on media item id only. After a second policy version was written, each media item matched once per version, so lists returned duplicates and totals were wrong. The fix joined the active catalog policy row and matched the evaluation's policy version to it, in every list, count and detail query.

## Looks risky but fine

The IMDb backfill selects candidates and saves the id by `tmdbId`, with no tie to a movie. Both the select and the update already restrict the type to shows, the candidate query hides deleted rows and orders by the unique id for its cursor, so a movie sharing the tmdb id can never be touched.
