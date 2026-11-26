---
paths:
  - "apps/api/**"
  - "apps/ai/**"
  - "apps/storefront/**"
  - "apps/pg-backup/**"
  - "packages/node-telemetry/**"
  - "infra/alloy/**"
---

# Logging

Every service writes one JSON object per line to stdout and ships the same record to Grafana Cloud Loki over OTLP through Alloy. Loki is where Veronica reads logs; Railway keeps only the last days of stdout.

## Format
- Shared logger: `createNestLogger` and `resolveLoggerSettings` from `@ratingo/node-telemetry`; `pg-backup` keeps its own copy in `infrastructure/structured-console.ts` because its image has no workspace packages
- Fixed fields: `time`, `level` (`debug`, `info`, `warn`, `error`), `service`, `environment`, `context`, `message`; errors add `error_name`, `error_message`, `error_stack` (the whole stack in one field, never split over lines)
- Correlation fields, only when they exist: `job_id`, `queue`, `job_name` (BullMQ), `request_id`, `http_method`, `http_route` (HTTP), `run_id` (AI agent runs)
- Put ids and counts in fields, not in the message text: `logger.log({ message: 'ai.run.finished', runId, costUsd })`; `runWithLogContext({ job_id }, fn)` adds fields to every record inside `fn`
- BullMQ processors take `@WithJobLogContext(QUEUE)` on `process`; the HTTP layer already binds the request id
- Loki index labels are only `service_name` and `deployment_environment_name`; ids, levels and routes are fields, filtered with `| job_id="..."` or `| detected_level="error"`. Never set `service.instance.id` or other per-deploy resource attributes

## Levels
- `error`: something a person should look at: a job failed after its last attempt, a request ended in 5xx, a dependency the service cannot work without is down
- `warn`: degraded but handled, and worth noticing if it keeps happening: a retry, a fallback, a rate limit, a provider answered with an error we recovered from
- `info`: lifecycle and business events: startup, shutdown, a job finished, a run finished, a scheduled change
- `debug`: per-item detail; off in production, so never the only trace of a failure
- Expected outcomes are not warnings: a 404 from a provider, a skipped item, a rejected match, a user's invalid input
- A loop over items never logs per item above `debug`: count in the loop and write one summary line after it (see `TvMazeEnrichmentService`)
- A failure that is retried is `warn`; log `error` once, when the last attempt fails

## Cost controls
Logs must stay cheap in Railway memory, CPU and network, and in Grafana Cloud. The shared shipper enforces this; every limit is an environment variable on the service:
- `LOG_LEVEL`: `info` in production; `debug` is for a short investigation, then unset
- `LOG_MAX_RECORD_BYTES` (4096): one record, stack trimmed first, then the message; string fields are capped at 500 characters
- `LOG_DEDUPE_WINDOW_SECONDS` (60): identical `warn` and `error` records (numbers and ids ignored) ship once per window, followed by one record with `repeats`; stdout keeps every line
- `LOG_SHIP_MAX_RECORDS_PER_MINUTE` (300) and `LOG_SHIP_MAX_BYTES_PER_DAY` (12 MB): `info` and `warn` stop at the minute rate and at 80 percent of the daily bytes; errors and repeat summaries may use twice the rate and the whole daily budget
- The export queue is capped at 2 MB; when Alloy is unreachable the oldest records are dropped and counted, never buffered without bound
- Counters `app.logs.records` (labels `outcome`, `level`) and `app.logs.bytes` (label `outcome`) show what was shipped, collapsed or dropped (`dropped_rate_limit`, `dropped_daily_cap`, `dropped_overflow`, `dropped_export_failed`); a growing `dropped_*` means a service is too chatty or a limit is too tight
- No per-request access lines: HTTP logs are 5xx (`error`), slow requests (`warn`) and 4xx other than 401 and 404 (`warn`)

## Secrets and personal data
- The logger redacts tokens, bearer and basic headers, JWTs, URL credentials, `key=value` secrets and email addresses in messages, fields and stacks, and replaces the value of keys such as `authorization`, `cookie`, `password`, `token`, `apiKey`, `secret`, `email`
- Redaction is the last line of defence: do not log request bodies, headers, cookies, tokens, emails, full prompts or webhook payloads
- Log the path without the query string; OAuth codes travel in the query

## Process
- Production processes start with `node`, not `npm run`, so there are no `npm notice` or `npm error` lines and SIGTERM is a normal stop
- The api closes on SIGTERM in this order: HTTP server (in-flight requests finish), then Nest providers (`onModuleDestroy`, e.g. Redis), then the log flush; do not use `enableShutdownHooks()` there, because Nest destroys providers before it closes the server
- A service that ends the process itself calls `await logger.flush()` first; the shipper batches for one second, and stdout stays the source of truth if a batch is lost
