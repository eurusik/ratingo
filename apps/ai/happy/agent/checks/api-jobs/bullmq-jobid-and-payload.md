---
id: bullmq-jobid-and-payload
paths:
  - 'apps/api/src/modules/**/application/**'
  - 'apps/api/src/modules/**/job-ids.ts'
  - 'apps/api/src/modules/**/*.module.ts'
  - 'apps/api/src/config/queue.config.ts'
  - 'apps/api/src/modules/shared/contracts/**'
triggers:
  - '[jJ]obId'
  - '\bqueue\.add\('
  - '\baddBulk\('
  - '\bregisterQueue\b'
  - '@Processor\b'
rule: api-modules.md#BullMQ jobs
severity_cap: major
---

## What to verify

BullMQ drops a job silently when a job with the same id is still stored in the queue. So a job id must be unique for exactly the unit of work it stands for, and a queue must not keep finished jobs forever. The payload keys written at enqueue time must be the keys the worker reads.

## Evidence required

Quote the jobId expression, or the registerQueue block, or the enqueue and the worker read side by side. For an id, name two different inputs that would produce the same string. For a payload, name the key written and the key read.

## Report only when

- A jobId is built from tmdbId alone. In media_items the tmdb id is unique only per type, so a movie and a show can share it and the second job is dropped.
- A jobId contains a colon. BullMQ rejects custom ids with colons, so the enqueue fails at runtime.
- A jobId has no run, day or window part, so a retained completed or failed job from an earlier cycle suppresses every later one.
- A queue is registered without removeOnComplete and removeOnFail in its default job options, or an enqueue overrides them away. Without them completed jobs pile up in Redis.
- The enqueued payload uses a different key from the one the worker or processor reads (offset against afterId, for example), or the payload is untyped so the compiler cannot catch it.

## Do not report

- Ids that already include the media item uuid or the media type next to the tmdb id.
- Ids deliberately scoped to the day or to a dispatch window through the shared builder.
- Queues that inherit cleanup options from a shared queue config.
- Generated contract files.

## Real bug example

The alt-titles backfill dispatcher queued jobs with the id backfill-alt, the tmdb id and the day. A movie and a show with the same tmdb id got the same id, so the second job was dropped. The fix builds the id from the media item uuid. Separately, two queues were registered with no cleanup options and grew to tens of thousands of finished jobs; and an admin endpoint queued offset while the worker paginated by afterId, so the cursor was ignored.

## Looks risky but fine

The shared builder for sync jobs combines the media type, the tmdb id and a day or hour window, for example movie, 42 and the UTC day. The type keeps movie and show apart, and the day scope lets tomorrow's run enqueue again after today's job finished.
