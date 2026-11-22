---
id: mutation-cache-coherence
paths:
  - 'apps/web-client/src/core/query/**'
  - 'apps/storefront/src/{entities,features,pages}/**/model/**'
  - 'packages/web-core/src/api/**'
triggers:
  - '\buseMutation\b'
  - '\bsetQueryData\b'
  - '\binvalidateQueries\b'
  - '\b(?:logout|login|signOut|signIn)\b'
  - '\bremoveQueries\b'
  - '\bapiPatch\b'
  - '\bapiDelete\b'
severity_cap: major
---

## What to verify

After a mutation or a session change, every cached view of the same data must be refreshed or reverted correctly. Look at which query keys are invalidated, what an error handler restores, which caches survive a login or logout, and how an empty success response is read.

## Evidence required

Quote the invalidation, rollback or API call. Name the key factory that is used and a sibling key that also holds the same data and is not covered. For rollbacks, say how many requests the mutation sends.

## Report only when

- A mutation invalidates a narrow key such as one tab of a list while sibling lists for the same user data, such as other tabs, saved items or calendar, stay stale. The shared prefix key should be invalidated.
- A mutation that sends several requests in sequence, such as chunked batches, restores a snapshot taken in onMutate on error. Earlier requests may already have succeeded, so the snapshot is wrong and the caches should be invalidated instead.
- A login, logout or account switch leaves per-user query data in the cache, so the next user briefly sees the previous one's state.
- A PATCH or DELETE helper treats a success response with a null data field as a failure, although the server uses it to say the entry was removed.

## Do not report

- A single-request optimistic mutation that restores its onMutate snapshot on error and then invalidates in onSettled.
- Invalidating a narrow key when no other cached view reads the same data.
- Optimistic updates that are followed by invalidation of the affected keys.

## Real bug example

After marking episodes watched, the progress hook invalidated only the history key of the me-lists. Shows stayed in the Watching, Paused and Dropped tabs until a full page reload. The fix invalidated the shared me-lists prefix. A related bug rolled back a stale snapshot after a chunked batch request failed part way, and a third treated a null PATCH body as an error when clearing a rating.

## Looks risky but fine

The save-item mutation sends exactly one request, stores the previous status in onMutate, restores it in onError and always invalidates the status key in onSettled. A single request either fully succeeds or fully fails, so rolling back the snapshot is correct.
