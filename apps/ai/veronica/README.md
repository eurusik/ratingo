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

## Answer log

Every finished exchange is stored in `ai.chat_exchanges` for 30 days: the question, the final checked answer, the outcome (`answered`, `flagged`, `fallback`, `failed`; older rows may say `redacted`), the numbers the guard flagged, the tool names and each call's arguments (`tool_calls`, redacted and capped), so a live answer can be audited. Tool results are never stored. A failed write is logged and never affects the reply.

### Chat eval

`eval/chat` replays fixed questions with fixture tool results. Google Analytics cases go through the real gateway and policy, with an in-process fake server that returns GA's real response shape. They need no GA key and no Python.

- **GA simulator.** The fake GA server is a small deterministic simulator (`eval/chat/google-analytics.dataset.ts` and `google-analytics.simulator.ts`). Synthetic facts (two weeks of traffic by country, device, channel, source, campaign and new vs returning, plus pages, events and a realtime slice) are aggregated by whatever valid dimensions, metrics, date ranges, filters, order and limit a call asks for, in GA's real response shape, including `dateRange` for two ranges. Metrics from different parts of the data are joined on shared dimensions (for example `date` with `activeUsers`, `screenPageViews` and `eventCount`), pages carry views, users, sessions and `engagementRate`, and only a combination the data cannot join (for example `country` with `eventCount`) gets GA's «incompatible» error. Unknown names get GA's error shape too. One campaign name is an injection string. Expected numbers in the GA cases are computed from the same simulator, and a period question accepts either the total or the full per-day series.
- **Wording checks.** They use shared stem patterns from `eval/chat/answer-stems.ts` (honest «no data», «no code review», «minor findings») instead of lists of exact phrases.

```bash
npm run eval:chat --workspace=@ratingo/ai-veronica
AI_MODEL_FAST=anthropic:claude-haiku-5-5 ANTHROPIC_API_KEY=… npm run eval:chat --workspace=@ratingo/ai-veronica
```

The first command uses the stub model and checks the harness. The second uses the real model; from Railway, run it with `railway run` so the Anthropic key comes from the service. `EVAL_DUMP=path.json` writes every answer for comparison.

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

Each draft has `id`, `question`, `expectedTools`, `reference.answer`, empty `fixtures` and `mustContain`, and an `observed` block with the outcome, flagged numbers, tool calls, cost, time (`createdAtMs`) and run id. Fill in the fixtures and the `mustContain` groups by hand, then add the case to `eval/chat/cases.ts`.

## Watchdog

A BullMQ scheduler runs a check every 5 minutes and sends a Telegram alert to the configured chat only when something changes, plus «✅ відновилось» on recovery.

| Alert          | Fires when                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| Happy down     | `GET {HAPPY_INTERNAL_URL}/health` failed on 2 consecutive checks (skipped when the variable is unset) |
| Digest missing | no sent digest for today's Kyiv date at 09:30 Europe/Kyiv or later                                    |
| Budget         | the day's spend of the agent or of the chat task is at least 80% of its budget                        |
| Failed runs    | at least 3 `failed` runs in the last hour                                                             |

Heartbeat: the gauge `app.ai.watchdog.last_tick_timestamp_seconds` (Prometheus `app_ai_watchdog_last_tick_timestamp_seconds`) holds the Unix time of the last finished tick. Alert on its absence or age to catch Veronica herself being down.

Happy's own spend is not checked: Happy keeps it in its own Redis keys, which Veronica does not read.
