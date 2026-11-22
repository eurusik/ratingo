---
id: side-effect-after-claim
paths:
  - 'apps/ai/*/src/modules/**/application/**'
  - 'apps/api/src/modules/{notifications,user-actions}/**/application/**'
triggers:
  - '\.(?:send|notify|emit|announce|deliver)\w*\('
  - '\b\w*(?:[Aa]nnounce|[Nn]otif|[Ss]end|[Ee]mit|[Dd]eliver)\w*\('
severity_cap: major
---

## What to verify

Jobs and workers are retried: BullMQ retries a failed job, a scheduler fires again, a process restarts mid-run. Anything that reaches a person or an external system (Telegram, push, email, an event that fans out to those) must happen only after a durable claim that says this unit of work is taken, so a retry or a second worker cannot repeat it.

## Evidence required

Quote the send or emit call and the statement that records it as done. State the order between them, and what a crash or a second run in between would do.

## Report only when

- The external send runs first and the record that it happened is written afterwards, so a crash between them resends on the next run.
- The only guard is a read such as wasSent followed by a later write. Two runs can both pass the read.
- A claim is taken and the send then fails, but nothing releases or expires the claim, so the work is never retried.
- Notification targets are chosen by comparing state before and after a sync instead of by claiming rows, so a retry or another writer changes who is told.

## Do not report

- Sends that follow an atomic claim, an update that returns the rows it changed, or a unique insert that fails on repeat.
- Release or stale-claim handling around the send.
- Sends that are idempotent on the receiver side by a stable key.
- Logging, metrics and in-process events with no external reach.

## Real bug example

The daily digest service checked whether today's digest was sent, composed it, sent it to Telegram, and only then marked the date as sent. A crash after the send, or a retried job, delivered the digest twice. The fix claims the date first, sends, and releases the claim if composing or sending throws.

## Looks risky but fine

The premiere announcement for subscriptions: one atomic update marks the active subscriptions that do not yet know the premiere date and returns exactly those rows. Only the returned rows become notification events, so a repeated sync tells nobody twice.
