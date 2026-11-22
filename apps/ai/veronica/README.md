# Veronica

Veronica is the ops assistant: a daily 09:00 (Kyiv) Telegram digest, a Telegram chat bot, and a watchdog. Design: `apps/ai/ARCHITECTURE.md`.

## Commands

```bash
npm run digest:preview --workspace=@ratingo/ai-veronica
npm run eval:chat --workspace=@ratingo/ai-veronica
npm run chat:export --workspace=@ratingo/ai-veronica -- --since=7d --outcome=redacted,fallback
npm run db:generate --workspace=@ratingo/ai-veronica
```

## Chat commands

`/help`, `/digest`, `/status`, `/queues`, `/site`, and `/last`, which shows the last three answers to free-form and Happy requests as «question → outcome, cost». Commands themselves are not listed.

## Answer log

Every finished exchange is stored in `ai.chat_exchanges` for 30 days: the question, the final checked answer, the outcome (`answered`, `redacted`, `fallback`, `failed`), the numbers the guard cut and the tool names. Tool payloads are never stored. A failed write is logged and never affects the reply.

### Turning real cases into eval cases

`chat:export` is read-only. It reads `DATABASE_URL` from the environment and prints a JSON array of eval case drafts to stdout.

```bash
DATABASE_URL=<prod url> npm run chat:export --workspace=@ratingo/ai-veronica -- --since=7d --outcome=redacted,fallback
```

- `--since` is required: `7d` or `12h`.
- `--outcome` is optional: a comma list of `answered`, `redacted`, `fallback`, `failed`.

Each draft has `id`, `question`, `expectedTools`, `reference.answer`, empty `fixtures` and `mustContain`, and an `observed` block with the outcome, cut numbers, cost, time (`createdAtMs`) and run id. Fill in the fixtures and the `mustContain` groups by hand, then add the case to `eval/chat/cases.ts`.

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
