---
id: external-call-resilience-and-quota
paths:
  - 'apps/api/src/modules/{tmdb,trakt,ingestion,monitoring,user-media}/**/adapters/**'
  - 'apps/api/src/modules/**/sync-media.service.ts'
  - 'apps/api/src/config/queue.config.ts'
triggers:
  - '\bfetch\('
  - 'HttpClient'
  - 'api\.trakt\.tv'
  - '\bconcurrency\b'
  - '[lL]imiter|[rR]ateLimit|RATE_LIMIT'
rule: api-modules.md#External HTTP
severity_cap: major
---

## What to verify

Calls to TMDB, Trakt, OMDb and similar providers share quotas and must stay polite. Every call goes through the resilient HTTP client, and Trakt calls also wait on the shared Trakt limiter, so a probe or a new job cannot add requests on top of sync traffic. The caller must tell a missing record from a failure, and must not ask a provider for data that cannot exist yet.

## Evidence required

Quote the call site. Name which of the client, the limiter or the guard is missing, and what traffic it adds. For not-found handling, quote the line that turns a 404 into an error or into an empty success.

## Report only when

- A provider is called with raw fetch or a fresh client that skips the resilient client, or a Trakt request is sent without acquiring a token from the shared limiter.
- Worker concurrency or a new queue raises parallel calls to a rate-limited provider without going through the same limiter.
- A not-found answer is mapped to a generic error, retried as if transient, or reported as healthy, so a normal absence looks like an outage or hides one.
- A call is made for a title that cannot have data: an unreleased movie asked for ratings, watchers or stats.

## Do not report

- Calls that acquire a limiter token and then use the resilient client.
- Provider calls inside tests and fixtures.
- Latency taken from the request start after the token wait, which is intended.
- Local or internal service calls that are not rate limited.

## Real bug example

The Trakt key health probe called the resilient client directly and never took a token from the shared limiter, so each probe added requests on top of running sync jobs. The fix injects the Trakt rate limit port, waits for a token and only then starts the latency timer. In the same family, sync-movie asked Trakt for ratings of movies that had not been released.

## Looks risky but fine

The key probe after the fix: it injects the rate limit port, awaits the token, records the start time, then calls the resilient client. A new client instance inside the adapter is acceptable because the limiter still gates the request.
