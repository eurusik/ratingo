# Ratingo AI — Architecture (ADR-001)

> Status: **Proposed** · Date: 2026-11-21
>
> `apps/ai` is a small agent platform. Agents are configuration on top of it. The first two agents are **Veronica** (daily project digest) and **Happy** (pull request code review).

---

## Context

Ratingo is run by one person. Two needs drive this:

1. **A daily digest.** One short Telegram message each morning that says whether anything needs attention: users, catalog freshness, site health, background queues, external API keys, backups. All the numbers already exist in Grafana Cloud (`ratingo-worker`, `ratingo-api`, `ratingo-storefront`, API keys, backup, Postgres, Redis dashboards), GA4 and Postgres, but nobody reads seven dashboards every morning.
2. **Code review without CodeRabbit.** The free tier runs out, and the paid plan costs $25/month. A reviewer that knows Ratingo's own rules (`.claude/rules/*`) costs a few dollars a month in model usage.

The platform is also a way to learn agentic programming, so the agent loop is written here rather than hidden in a framework.

Prior art: a production multi-agent assistant was studied before writing this. What we keep from it: every trigger becomes one run handled by one loop; skills are loaded on demand; schedules and rules live in files; agents are manifests rather than separate services; every run is metered. What we avoid: one process holding every credential, a safety check that lets a command through when the check itself fails, configuration changes going live without review, and no tests.

---

## Decision

### Platform plus agents

```
apps/ai/
├── src/                        # the platform, knows nothing about any agent
│   ├── main.ts                 # HTTP entry: Telegram callbacks, GitHub webhooks, health
│   ├── config/                 # Joi env schema, model aliases, prices
│   └── modules/
│       ├── llm/                # model port, provider adapters, aliases, fallback, pricing
│       ├── tools/              # tool registry, tool sources (native, MCP, skills)
│       ├── agent/              # agent loop, Run entity, budgets
│       ├── agents/             # loads agent manifests, tasks and prompts
│       ├── triggers/           # schedule, Telegram callbacks, GitHub webhooks
│       ├── delivery/           # Telegram, GitHub review (Slack later)
│       ├── runs/               # run log, cost, review state
│       ├── digest/             # collectors, rules, Telegram template
│       └── review/             # diff, rule selection, findings, posting
└── agents/
    ├── veronica/
    │   ├── agent.yaml
    │   ├── prompts/
    │   └── tasks/              # daily-digest.md, weekly-digest.md
    └── happy/
        ├── agent.yaml
        └── prompts/
```

Adding an agent means adding a folder under `agents/`. Adding a data source means adding a collector or a tool. Adding a channel means adding a delivery adapter. Adding a model provider means adding an adapter and one line of config. None of these touch the agent loop.

### Routing: no orchestrator agent

The platform is the front door, not a "super agent". Triggers route deterministically: the daily schedule starts Veronica, a GitHub `pull_request` webhook starts Happy, a Telegram button starts the run it belongs to. No model decides who handles what, so routing costs nothing and never guesses wrong.

Inside a run, the loop can split work into parallel sub-runs of the same agent, each with a clean context and its own budget. Agents do not call each other directly; they read each other's results through `RUN_REPOSITORY` (for example, Veronica's digest reports what Happy reviewed yesterday).

An orchestrator becomes useful only when a free-form entry point exists, such as chatting with the bot in Telegram. Then a thin router comes first: deterministic matches, and a cheap classification call only when nothing matches. Agents may later be exposed to each other as tools (`ask_agent`), with the callee's own credentials and budget.

### Clean / Hexagonal, same rules as `apps/api`

Every module follows `.claude/rules/architecture.md` and `.claude/rules/domain-layer.md`:

- `presentation → application → domain ← infrastructure`
- Ports are interfaces in `domain/ports/*.port.ts` with a `Symbol` token; adapters live in `infrastructure/adapters/*.adapter.ts`
- Modules expose only `public/index.ts`
- Time comes from `CLOCK_PORT`, decisions from `as const` constants, errors are domain errors
- Framework: NestJS + Fastify, like `apps/api`, so DI picks adapters from config

| Port | Purpose | First adapters |
| --- | --- | --- |
| `MODEL_PORT` | One model call: messages + tools in, content + tool calls + usage out | Anthropic, OpenAI-compatible, Ollama, Stub |
| `TOOL_SOURCE_PORT` | Lists and runs tools | Native tools, MCP client, skills |
| `METRICS_PORT` | PromQL instant/range queries | Grafana Cloud Prometheus |
| `ANALYTICS_PORT` | Visitors, sign-ups, top pages | GA4 Data API |
| `PRODUCT_STATS_PORT` | Ratings, saves, imports, new titles | Postgres, read-only role |
| `CODE_HOST_PORT` | PR diff, files, review comments, check runs | GitHub App |
| `DELIVERY_PORT` | Send, edit, attach buttons | Telegram; GitHub review |
| `RUN_REPOSITORY` | Run log, review state | Postgres |
| `LOCK_PORT` | Run-once locks, webhook de-duplication | Redis |
| `CLOCK_PORT` | Time | System clock; fixed clock in tests |

### Provider-agnostic models

The core never imports a provider SDK. It speaks neutral types: `ChatMessage`, `ToolDefinition`, `ToolCall`, `ToolResult`, `ModelUsage`, `ModelCapabilities`.

- **Aliases, not model names.** Agents and tasks ask for `fast`, `review` or `smart`. Config maps each alias to `provider:model`:

  ```
  AI_MODEL_FAST=anthropic:claude-haiku-5-5
  AI_MODEL_REVIEW=anthropic:claude-sonnet-5-5
  AI_MODEL_SMART=anthropic:claude-opus-5-5
  AI_MODEL_REVIEW_FALLBACK=openai-compatible:<model>
  ```

  Switching provider is a config change, not a code change.

- **Adapters own the translation.** Each adapter maps neutral tool schemas to its provider's format and maps the response back. The Anthropic adapter uses the official `@anthropic-ai/sdk`.
- **Capabilities are flags.** Prompt caching, adaptive thinking, structured output and images are declared per adapter. The core works without them; an adapter that has them uses them.
- **Fallback chain.** If a provider fails or refuses, the run continues on the next model in the alias's fallback list, and the run log records the switch.
- **Prices are config.** A price table per `provider:model` gives the same cost accounting for every provider.

### Tools

A tool is defined once: name, description, zod input schema, handler, `readOnly` flag, output size cap. The registry exposes it to any provider through the adapter.

Tool sources:

- **Native.** PromQL query, Loki log query, queue state, PR diff, read file at a ref, post review.
- **MCP.** Any MCP server listed in an agent manifest becomes a tool source; its tools are namespaced and go through the same allowlist.
- **Skills.** A skill is a prompt plus the tools it brings. The system prompt lists only skill names and one-line descriptions; the model loads the body on demand. This keeps context small.

An agent sees only the tools its manifest allows. Anything not allowed is denied.

### The agent loop

`AgentLoop.run(run)`:

- calls `MODEL_PORT`, runs requested tools, feeds results back, until the model returns a final answer
- stops at `maxTurns`, `maxCostUsd` or wall-clock timeout, and records why it stopped
- caps every tool result and truncates with a note
- persists the run after every turn, so a restart can resume or report it
- returns structured output when the task asks for it, validated with zod

The loop is used only where the model has to decide what to look at: investigations and code review. Numbers in the digest never go through it.

### Agent manifest

```yaml
name: veronica
description: Daily project digest and on-demand investigation
models: { default: fast }
tools: [prom_query, loki_query, queue_state, ga4_report, product_stats]
skills: [ratingo-queues, ratingo-external-apis]
delivery: telegram
credentials: [GRAFANA_PROM_TOKEN, GA4_CREDENTIALS, PRODUCT_DB_URL, TELEGRAM_BOT_TOKEN]
budgets: { perRunUsd: 0.05, perDayUsd: 0.5 }
```

Tasks are Markdown files with frontmatter:

```markdown
---
schedule: '0 9 * * *'
timezone: Europe/Kyiv
model: fast
budgetUsd: 0.02
---
Write the headline and action lines for today's digest from the snapshot below...
```

Schedules are registered as BullMQ job schedulers, the same mechanism `apps/api` uses.

---

## Veronica: the daily digest

The digest is a pipeline, not a conversation. Code produces every number; the model writes only words.

```
collectors → snapshot + source status → rules → template → model (headline, actions, one "interesting" line) → Telegram
```

1. **Collectors** query `METRICS_PORT`, `ANALYTICS_PORT` and `PRODUCT_STATS_PORT` for the 24h window (Kyiv day boundaries, converted to UTC explicitly) and the same window 7 days earlier. Each source reports `ok` or `unavailable` with a reason.
2. **Rules** assign one of three levels: `action`, `note`, `ok`. Severity follows impact, not counts: Trakt 429s that all succeeded on retry are a `note`, not an `action`. Expected noise, such as 404 from TVMaze or MDBList for titles they do not have, is never an alert. Thresholds and minimum volumes live in config. Rules are pure functions with property-based tests (fast-check).
3. **Template** renders Telegram HTML: verdict line first, numbered actions, one line per block (people, catalog, site, background jobs, keys/backup/database), details in an expandable blockquote, source status and run cost in the footer. Green days are sent silently.
4. **Model** gets the snapshot and returns structured text for the headline, action wording and the "interesting" line. It never produces numbers.
5. **Buttons** start an investigation run: the agent loop with read-only tools, answered as a reply with turns and cost.

Digest rules:

- verdict first, actions instead of observations, plain words instead of jargon
- every number has a baseline ("as usual", "usually ~30")
- product (users, catalog freshness) before infrastructure
- a missing source is shown as missing, never as zero
- the digest is sent every day, including quiet days, so a missing digest is itself a signal

### Prerequisite in `apps/api`

Per-job counters in Prometheus reset on every deploy, so a job that runs once a day looks like it never ran. Before the digest checks schedules, `apps/api` exports a last-success timestamp gauge per scheduled job, the same way the backup service already does. Until then the digest does not report on nightly jobs.

---

## Happy: code review

1. **Trigger.** GitHub App webhook on `pull_request` (`opened`, `synchronize`, `ready_for_review`). The signature is verified and the delivery ID de-duplicated through `LOCK_PORT`.
2. **Incremental diff.** `RUN_REPOSITORY` stores the last reviewed commit per PR; only new changes are reviewed.
3. **Filtering.** Lockfiles, `packages/api-contract` generated types, snapshots and migrations metadata are skipped.
4. **Rules as context.** For each changed path, the matching `.claude/rules/*.md` (by their `paths:` frontmatter) and `CLAUDE.md` are added.
5. **Findings.** The model returns structured findings: file, line, severity, message, suggestion. Code checks every line against the diff hunks and drops the rest.
6. **Posting.** One review with inline comments and one summary comment that is updated in place. Findings are fingerprinted so the same issue is not posted twice.
7. **Shadow mode first.** For the first weeks Happy posts only a check run summary while CodeRabbit keeps reviewing. CodeRabbit is turned off once Happy finds as many real issues with less noise.

Model: `review` alias (Sonnet class). A cheap first pass on the `fast` alias can mark risky files so the larger model reads only those.

---

## Security

- **One credential set per agent.** Variables are prefixed per agent and injected only into that agent's tools. Happy never sees Grafana, GA4 or database credentials; Veronica never sees GitHub write access.
- **Least privilege.** Grafana service account with Viewer role, Postgres role with `SELECT` on the listed tables, GitHub App with `contents: read`, `pull_requests: write`, `checks: write`.
- **No shell tool.** Tools are typed functions. Nothing runs code from a PR or from model output.
- **PR content is untrusted input.** It goes to the model as data inside clear delimiters, never as instructions, and Happy has no tool that could act on an injected instruction beyond writing a comment.
- **Telegram.** Callbacks are accepted only from an allowlist of chat IDs and with the webhook secret token.
- **Budgets.** Per run and per day, per agent. A run that hits the budget stops and says so.
- **Deny by default.** Any check that cannot complete denies the action.

---

## Observability

The platform uses `@ratingo/node-telemetry` and exports through the same Grafana Cloud pipeline as the API:

- `app_ai_runs_total{agent, task, trigger, outcome}`
- `app_ai_run_cost_usd_total{agent, task, model}`
- `app_ai_run_tokens_total{agent, model, kind}`
- `app_ai_run_duration_seconds{agent, task}`
- `app_ai_tool_calls_total{agent, tool, outcome}`

Logs carry run IDs and outcomes, not prompt or PR contents. A Grafana dashboard `Ratingo / AI` follows the existing dashboards.

---

## State

- **Postgres**, own schema `ai` in the existing database, Drizzle migrations in `apps/ai`, every statement re-runnable (`IF NOT EXISTS`):
  - `ai.runs`: agent, task, trigger, status, stop reason, model, tokens, cost, started/finished, summary
  - `ai.review_state`: repository, PR, last reviewed commit, posted finding fingerprints
- **Redis**: run-once locks per task window, webhook de-duplication, Telegram callback state with TTL.

---

## Testing

- **Stub model** with scripted scenarios: normal run, runaway loop, tool error, budget exceeded, provider failure with fallback.
- **Adapter contract tests:** every `MODEL_PORT` adapter passes the same suite on recorded responses.
- **Property-based tests** for digest rules.
- **Golden tests** for the Telegram template (green, yellow, red days).
- **Review eval set:** past PRs with known issues; Happy's findings are scored before each prompt or model change.
- Each step follows the repo's review routine: `code-review`, `clean-code`, `clean-ddd-hexagonal`.

---

## Deployment

- Railway service `ai` from `apps/ai/Dockerfile`, dev environment first (`development` branch), production after the digest has run for a week.
- CI jobs added to `.github/workflows/ci.yml` on path changes: lint, typecheck, tests, build.
- Config only through env (Joi schema); no defaults that name Ratingo hosts or IDs in code.

---

## Rollout

1. **Core:** neutral types, Stub and Anthropic adapters, agent loop with budgets, run log, metrics.
2. **Veronica digest:** collectors, rules, template, Telegram delivery, daily schedule. Prerequisite gauge in `apps/api`.
3. **Investigation buttons:** loop with read-only tools.
4. **Happy in shadow mode:** GitHub App, incremental review, check run summary.
5. **Happy live**, CodeRabbit off.
6. **Later:** weekly digest, instant alerts without a model, chat with Veronica in Telegram, skills catalog, more agents.

---

## Consequences

- One more Railway service to run and pay for.
- The loop and adapters are ours to maintain. In exchange the platform is not tied to one provider or framework, and every step is visible.
- Neutral types cover the common subset of providers. Provider-specific features are available through capability flags, not in the core.
- The digest is only as good as its metrics. Missing metrics are fixed at the source, starting with the scheduled-job gauge.

## Open questions

- Which GA4 metrics count as "active users" for Ratingo.
- Telegram: one private chat, or a channel for history.
- Whether Happy's shadow mode posts a check run or a hidden comment.
- Whether Ollama is supported in production or only for local development.
