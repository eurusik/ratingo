---
id: air-date-null-and-time-basis
paths:
  - 'apps/api/src/modules/{user-media,catalog,shared/show-premiere}/**'
  - 'apps/storefront/src/{entities/episode,pages/calendar}/**'
  - 'apps/api/src/config/scheduler.config.ts'
  - 'apps/api/src/database/{show-premiere,movie-release}-conditions.ts'
triggers:
  - '\b(?:airDate|releaseDate|firstAirDate|air_date|release_date)\b'
  - '\bnew Date\('
  - '\b(?:updatedAt|updated_at)\b'
  - '\b(?:cron|pattern)\b\s*:'
  - '\bhasAired\b'
rule: api-modules.md#Dates
severity_cap: major
---

## What to verify

A missing date means unknown, never already happened. Date ranges and aired checks must use one agreed time basis, and the time when a user acted must come from a column that only user actions change.

## Evidence required

Quote the comparison, range bound, order clause or schedule. State what happens for a null or unparseable date, what the bound is based on, or which writers can move the column.

## Report only when

- A null, empty or unparseable air or release date makes an episode or title count as aired, released or trackable.
- A range bound for a day or window uses the current instant instead of the start of the UTC day, so items from earlier today drop out or appear twice.
- An updated_at column is used to order lists, group by day or report when a user did something, although jobs, syncs and rating-only upserts also bump it. Creation time or a dedicated action timestamp is the right column.
- A scheduled cron entry has no tz and runs in the server zone.
- An aggregate such as min or max over air dates stands in for one specific episode's date, so a null on that episode lets another episode's date win and the result disagrees with views that read that episode directly.
- Aired logic is written again inline where a shared helper already exists (the episode airing policy on the API, hasAired in the storefront entity, the show premiere helper).

## Do not report

- updatedAt set to new Date() inside infrastructure repositories and queries. Only domain code must use the injected clock.
- Comparing dates that are already known to be present, such as after a not-null filter.
- Display formatting of dates.

## Real bug example

The storefront treated an episode without an air date as aired. Users could mark promo clips without dates, but the API ignores undated episodes in progress, so the marks vanished and a show could never be finished. The fix made hasAired require a parseable date that is not in the future, and the row now says the date is not announced yet.

The show premiere helper took min(air_date) over all regular episodes as the premiere. When S1E1 had no date but S1E2 did, the anticipated rail showed S1E2's date as the premiere, while the premieres calendar, which lists only episode 1, never had it.

## Looks risky but fine

A stub upsert in a catalog infrastructure query sets updatedAt to new Date() on conflict. That is plain bookkeeping in the persistence layer, not a domain decision, so it does not need the injected clock.
