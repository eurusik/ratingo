# Veronica

Veronica is the ops assistant: a daily 09:00 (Kyiv) Telegram digest, a Telegram chat bot, and a watchdog. Design: `apps/ai/ARCHITECTURE.md`.

## Commands

```bash
npm run digest:preview --workspace=@ratingo/ai-veronica
npm run eval:chat --workspace=@ratingo/ai-veronica
npm run chat:export --workspace=@ratingo/ai-veronica -- --since=7d --outcome=flagged,fallback
npm run chat:flags --workspace=@ratingo/ai-veronica -- --since=7d
npm run db:generate --workspace=@ratingo/ai-veronica
```

## System card

The chat system prompt ends with a card that says which scheduled jobs, queues and external APIs Ratingo has, what each does and how often each job runs, in words. It is rendered from `src/modules/chat/domain/constants/system-card.json`, which is generated from `apps/api` code (`SCHEDULED_JOBS`, `MONITORED_QUEUES`, `EXTERNAL_PROVIDERS`, each job's `description`). After changing a scheduled job, a queue or a provider in the API, run `npm run system-card:update`; an API test fails while the checked-in card is stale. The cadence words come from the cron pattern (`schedule-cadence.policy.ts`), and the rendered card must stay under `SYSTEM_CARD_MAX_CHARS`. The card holds no digits (numbers are spelled out) and is not a source for the numbers guard, so it cannot vouch for a number in an answer.

## Chat commands

`/help`, `/digest`, `/status`, `/queues`, `/site`, and `/last`, which shows the last three answers to free-form and Happy requests as «question → outcome, cost». Commands themselves are not listed. `/help` also says that free-form questions about site visitors are answered from Google Analytics.

## Google Analytics

Veronica answers questions about visitors to ratingo.top from Google Analytics 4: users, traffic sources, top pages, devices, countries, new vs returning, realtime, period comparisons and single event counts. She uses Google's `analytics-mcp` through the ai-core MCP gateway; see `packages/ai-core/README.md` for the policy.

| Variable              | Secret | Value                                                             |
| --------------------- | ------ | ----------------------------------------------------------------- |
| `GA_CREDENTIALS_JSON` | yes    | the whole JSON key of the read-only service account, as one value |
| `GA_PROPERTY_ID`      | no     | the numeric GA4 property id, for ratingo.top `515589933`          |

A chat message never waits for the Python server. Veronica starts it and lists its tools in the background at boot, and the GA tools are offered once that listing is ready. Until then, usually a few seconds after a deploy, GA questions get the honest «даних немає».

What happens with these variables:

- **Missing or invalid.** If either variable is missing, the key is not a service account key, or the property id is not numeric, a warning names the variable, never its value. Google Analytics stays off and the chat works as before.
- **Valid.** The key is written to a private temp file (`0600`), the subprocess gets only its path, and the file is deleted on shutdown.

The server is installed in the image at `/opt/analytics-mcp-1.1.0` from `analytics-mcp/requirements.lock` (hash-pinned, binary wheels only, nothing downloaded at runtime). To update it:

1. Bump the version in `analytics-mcp/requirements.in`, `GOOGLE_ANALYTICS_MCP_VERSION` in ai-core and `ANALYTICS_MCP_HOME` in the Dockerfile.
   Every stage builds from one `NODE_IMAGE` pinned by digest, so Alpine's `python3` stays the version the lock was resolved for. To update Node or Python, bump the digest, rebuild and run the image's smoke test.
2. Regenerate the lock in an Alpine amd64 container with `pip-compile --generate-hashes --strip-extras --no-header --no-annotate --allow-unsafe`.

A test fails if the three places disagree.

What to watch in Grafana:

- `app.ai.mcp.calls{server="google-analytics"}` by `outcome` (`timeout`, `unavailable` and `refused` should stay rare);
- `app.ai.mcp.call.duration`;
- `app.ai.mcp.server.events` for `start_failed`, `crashed`, `recycled_after_timeout`, `unconfigured`, `tool_missing` and `required_argument_hidden`.

## Logs

Veronica reads production errors and warnings from Grafana Cloud Loki with the `logs_search` tool; the design is in `apps/ai/ARCHITECTURE.md` and the log format in `.claude/rules/logging.md`. Without the three variables below the tool reports itself unavailable and everything else works.

| Variable             | Secret | Value                                                               |
| -------------------- | ------ | ------------------------------------------------------------------- |
| `GRAFANA_LOKI_URL`   | no     | the stack's Loki URL from the stack Details page, without any path  |
| `GRAFANA_LOKI_USER`  | no     | the numeric Loki user (instance id) from the same Details page      |
| `GRAFANA_LOKI_TOKEN` | yes    | a Cloud access policy token with the `logs:read` scope on the stack |

`GRAFANA_PROM_TOKEN` is a Grafana service account token with the Viewer role, sent as a bearer token to the metrics API. Cloud Loki does not take it: its query endpoint wants basic auth with the Loki user and an access policy token that carries `logs:read`, so the logs token is a new one.

Creating the token (Grafana Cloud, as a stack admin):

1. Open the stack in Grafana, then Administration, Users and access, Cloud access policies, Create access policy. In the Cloud portal the same page is Security, Access Policies.
2. Name it `veronica-logs-read`, pick the stack as the realm, and under Scopes tick only `logs:read`. Leave every `write` and `delete` scope off.
3. Create, then on the policy choose Add token, name it, set an expiration date (for example one year, and note it in the calendar) and copy the token once; it is shown only once.
4. In the Cloud portal open the stack, then Details, and in the Loki block copy the URL and the User.
5. In Railway, on the Veronica service, set `GRAFANA_LOKI_URL`, `GRAFANA_LOKI_USER` and `GRAFANA_LOKI_TOKEN`, then redeploy. Ask Veronica for the errors of a service to check it; `access_denied` in her answer means the scope or the user is wrong.

## Reading the database

`db_schema` and `db_query` let Veronica read the application database without a code change per question. They connect as the `ai_explorer` role, which the API migration creates without a password; private data (emails, usernames, password hashes, tokens, sessions, OAuth accounts, user notes) is closed by the database itself. Design and limits: [`apps/ai/ARCHITECTURE.md`](../ARCHITECTURE.md) (Database explorer).

1. After the API migration `0044` is deployed, set the password of the role in `psql` as an admin (`\password ai_explorer`, then `ALTER ROLE ai_explorer LOGIN`).
2. In Railway, on the Veronica service, set `AI_EXPLORER_DATABASE_URL` to the same host, port and database as `AI_READER_DATABASE_URL` with the user `ai_explorer` and that password, then redeploy. Without it both tools answer that they are not configured.
3. Ask for the number of users and for user emails: the first answers with a number, the second must say the data is private.

The eval cases that need the database (`db-*`) run against a throwaway database created from the API migrations when `EXPLORER_EVAL_DATABASE_URL` is an admin URL of a Postgres (for example `postgres://ratingo:ratingo_dev_password@localhost:5434/postgres` with `docker-compose up postgres-v2`). Without it they are listed as skipped, the baseline is not saved and the run is not compared as a full run.

## Answer log

Every finished exchange is stored in `ai.chat_exchanges` for 30 days: the question, the final checked answer, the outcome (`answered`, `flagged`, `fallback`, `failed`; older rows may say `redacted`), the numbers the guard flagged, the tool names and each call's arguments (`tool_calls`, redacted and capped), so a live answer can be audited. Tool results are never stored. A failed write is logged and never affects the reply.

### Chat eval

`eval/chat` replays fixed questions with fixture tool results and scores the answers. Google Analytics cases go through the real gateway and policy, with an in-process fake server that returns GA's real response shape. They need no GA key and no Python. How the score is built, how to read the report and the merge rule are in `apps/ai/ARCHITECTURE.md` (Eval); the short version:

- **Repeated runs.** Each case runs 3 times (`--runs`) and passes at 2 (`--pass-at`). A case whose runs disagree is marked `FLAKY` and reported apart.
- **Meaning, not wording.** A case lists short English statements: what a correct answer conveys and what it must not claim. A judge model (Sonnet 5.5) scores each answer against them. Invented numbers and dates (the numbers guard), links, secrets, gendered or formal address and injected text are checked in code, and tools are checked as required and forbidden lists.
- **Baseline.** `eval/chat/baseline.json` holds the last accepted result per case. Every run is compared with it; `--save-baseline` replaces it, but refuses while the report shows regressions unless `--force-baseline` is added.
- **GA simulator.** The fake GA server is a small deterministic simulator (`eval/chat/google-analytics.dataset.ts` and `google-analytics.simulator.ts`). Synthetic facts (two weeks of traffic by country, device, channel, source, campaign and new vs returning, plus pages, events and a realtime slice) are aggregated by whatever valid dimensions, metrics, date ranges, filters, order and limit a call asks for, in GA's real response shape, including `dateRange` for two ranges. Metrics from different parts of the data are joined on shared dimensions (for example `date` with `activeUsers`, `screenPageViews` and `eventCount`), pages carry views, users, sessions and `engagementRate`, and only a combination the data cannot join (for example `country` with `eventCount`) gets GA's «incompatible» error. Unknown names get GA's error shape too. One campaign name is an injection string. Expected numbers in the GA cases are computed from the same simulator, and a period question accepts either the total or the full per-day series.

```bash
npm run eval:chat --workspace=@ratingo/ai-veronica
AI_MODEL_FAST=anthropic:claude-haiku-5-5 ANTHROPIC_API_KEY=… npm run eval:chat --workspace=@ratingo/ai-veronica
```

The first command uses the stub model and a fake judge and checks the wiring (cases, fixtures, scoring); it needs no key and runs in CI through `eval.spec.ts`. The second uses the real model; from Railway, run it with `railway run` so the Anthropic key comes from the service. Options go after `--`: `--runs=3 --pass-at=2 --concurrency=4 --max-cost-usd=4 --only=id1,id2 --baseline=path --save-baseline --calibrate --calibrate-only --judge-model=anthropic:claude-sonnet-5-5 --dump=path.json` (`--dump` writes every answer and verdict).

### Weekly flags review

The numbers guard never cuts an answer. A number it cannot verify is listed under the answer («Не звірено з даними: …»), and the outcome is `flagged`. To see whether flags are real errors:

```bash
DATABASE_URL=<prod url> npm run chat:flags --workspace=@ratingo/ai-veronica -- --since=7d
```

It is read-only and prints JSON:

- `answers`: free-form answers in the period;
- `flaggedAnswers`: how many of them had flags;
- `numbers`: each flagged number with how often it was flagged;
- up to 20 recent `examples`, each with the question, the flagged numbers and the tool calls with their arguments.

The chat eval reports the same thing on its fixtures: answers with flagged numbers, flagged numbers that are wrong, and the false-flag rate (flagged numbers that are true for the case).

### Turning real cases into eval cases

`chat:export` is read-only. It reads `DATABASE_URL` from the environment and prints a JSON array of eval case drafts to stdout.

```bash
DATABASE_URL=<prod url> npm run chat:export --workspace=@ratingo/ai-veronica -- --since=7d --outcome=flagged,fallback
```

- `--since` is required: `7d` or `12h`.
- `--outcome` is optional: a comma list of `answered`, `flagged`, `redacted` (older rows), `fallback`, `failed`.

Each draft has `id`, `question`, `requiredTools`, `reference.answer`, empty `fixtures` and empty `expectations` (`conveys`, `mustNotClaim`), and an `observed` block with the outcome, flagged numbers, tool calls, cost, time (`createdAtMs`) and run id. Fill in the fixtures and the expectations (one short sentence each) by hand, then add the case to `eval/chat/cases.ts`.

## Watchdog

A BullMQ scheduler runs a check every 5 minutes and sends a Telegram alert to the configured chat only when something changes, plus «✅ відновилось» on recovery.

| Alert                    | Fires when                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Happy down               | `GET {HAPPY_INTERNAL_URL}/health` failed on 2 consecutive checks (skipped when the variable is unset)                              |
| Digest missing           | no sent digest for today's Kyiv date at 09:30 Europe/Kyiv or later                                                                 |
| Budget                   | the day's spend of the agent or of the chat task is at least 80% of its budget                                                     |
| Failed runs              | at least 3 `failed` runs in the last hour                                                                                          |
| Happy, DUM-E budget      | the 24 hour spend of the agent, from Prometheus, is at least 80% of the budget the agent publishes (`app_ai_agent_budget_day_USD`) |
| Happy, DUM-E failed runs | at least 3 runs with outcome `model_error` or `unexpected_error` in the last hour, from Prometheus                                 |

Heartbeat: the gauge `app.ai.watchdog.last_tick_timestamp_seconds` (Prometheus `app_ai_watchdog_last_tick_timestamp_seconds`) holds the Unix time of the last finished tick. Alert on its absence or age to catch Veronica herself being down.

Happy's and DUM-E's spend and failed runs come from Prometheus (`app_ai_run_cost_USD_sum`, `app_ai_runs_total`), which every agent exports at the end of each run, so a run killed before it ends is missing there. Veronica's own checks read her Postgres table.
