---
id: ssr-cache-and-memory
paths:
  - 'apps/storefront/**'
  - 'apps/web-client/**'
  - 'packages/web-core/src/query/**'
triggers:
  - '\bgcTime\b'
  - '\bisrFlushToDisk\b'
  - '\bexpireTime\b'
  - '\bcacheHandler\b'
  - '\binitialData\b'
  - '\brouter\.refresh\('
  - '<Script\b'
  - '\bgetDictionary\b'
  - '\brevalidate\b'
severity_cap: major
---

## What to verify

Ratingo web apps run as long-lived Next.js standalone servers, so anything a server render leaves behind stays in memory or on disk until the process dies. Check four things: a cache or timer that retains finished renders, ISR data that is handed to the client as fresh, a refresh that re-runs a server path that can throw, and analytics or dictionaries that only exist after hydration.

## Evidence required

Quote the option or call. Name the cache, timer or render that is retained and what bounds it, or name the page that is ISR-cached and the query that receives its data as initialData. Say where the code runs: server render, browser only, or both.

## Report only when

- A QueryClient default or a per-query gcTime is a finite number on the server. Every query used during a render then schedules a timer that keeps the whole render alive. The server value must be Infinity.
- A per-query gcTime overrides the shared server default without an isServer guard.
- Next config turns on a disk-backed ISR or fetch cache, or a custom cache handler, without a size bound, so crawlers walking unique pages grow memory or disk without limit.
- initialData built from an ISR or cached server fetch is given to a query with a positive staleTime and no initialDataUpdatedAt, so the client never refetches and shows data up to an hour old.
- router.refresh() is called on a route whose server component can throw for the current state, which turns a refresh into an error page.
- An analytics script or a translation dictionary is created after hydration, so early events or first paint are lost.

## Do not report

- A long gcTime in code that only runs in the browser, such as a client-only hook guarded by isServer.
- initialData for data that cannot change during the revalidate window.
- Changes to revalidate values alone.

## Real bug example

The shared QueryClient used a five minute gcTime on the server. Crawlers requesting unique movie pages made every render schedule a five minute timer, and production memory grew from about 1 GB to 6 GB. The fix set gcTime to Infinity when running on the server and turned off the on-disk ISR cache. The same mistake came back later as a per-query gcTime that overrode the server default.

## Looks risky but fine

A query for imported rated shows uses a gcTime of one hour, written as isServer ? Infinity : RATED_SHOWS_GC_MS. The long value only applies in the browser, and the server keeps the shared Infinity default, so no timer is scheduled during a render.
