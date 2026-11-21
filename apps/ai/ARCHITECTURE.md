# Ratingo AI — Architecture (ADR-001)

> Status: **Proposed** · Date: 2026-11-21
>
> A small agent platform. One shared core package and one service per agent. The first agents are **Veronica** (daily project digest and Telegram chat) and **Happy** (pull request code review). **DUM-E** (read-only search) comes later.

---

## Context

Ratingo is run by one person. Two needs drive this:

1. **A daily digest.** One short Telegram message each morning that says whether anything needs attention: users, catalog freshness, site health, background queues, external API keys, backups. The numbers already exist in Grafana Cloud (worker, API, storefront, API keys, backup, Postgres and Redis dashboards), GA4 and Postgres, but nobody reads seven dashboards every morning.
2. **Code review without CodeRabbit.** The free tier runs out and the paid plan costs $25/month. A reviewer that knows Ratingo's own rules costs a few dollars a month in model usage.

Later, a Telegram chat: ask a question in plain language and the right agent answers.

It is also a learning project, so the agent loop is written here rather than hidden in a framework.

---

## Lessons from prior art

A production multi-agent assistant was studied before writing this: one service for a whole engineering organisation, with Slack, webhooks and schedules as inputs, many integrations, and agents defined as configuration.

### Strengths we keep, and where we go further

| Prior art                                                                          | Here                                                                                                         |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Chat, webhooks and schedules all become one conversation handled by one loop       | Every trigger becomes a `Run` handled by the core `AgentLoop`; a new source is a new adapter                 |
| Integration skills are listed by name and loaded on demand, keeping context small  | Same, through the skills loader in the core                                                                  |
| Code knows nothing about the company; hosts, IDs and prompts live outside the code | Same: env and agent folders hold everything specific to Ratingo                                              |
| Schedules and event rules are files                                                | Same, but they ship with the code through a PR, CI and review instead of being pulled live from another repo |
| Agents are manifests on a shared runtime                                           | Manifests on a shared core, and each agent also runs as its own service for isolation                        |
| Event routing is deterministic, by rules rather than by a model                    | Same; a model router is used only for free-form chat, last                                                   |
| Loop limits on rounds, cost and sub-agents                                         | Same, plus a worst-case budget check before every call and a clear precedence between budget levels          |
| Tokens and cost recorded per conversation                                          | Same per run, plus an alert when the daily digest does not happen                                            |

### Weaknesses we design out

| Prior art                                                                                       | Here                                                                                                                  |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| One process holds every integration credential, and model-driven shell commands see all of them | One service per agent with only its own variables; no shell tool; MCP subprocesses get a minimal explicit environment |
| The command safety check lets a command through when the check itself fails                     | No shell to guard; every check denies by default                                                                      |
| Writes are guarded only by prompt text                                                          | Writes need a server-side pending action confirmed by a button; Happy can only post `COMMENT` reviews                 |
| Production behaviour changes about a minute after a push to the rules repo, without review      | Prompts, manifests and tasks change only through a reviewed PR and a deploy; manifests are validated at boot          |
| Shared Redis without auth; personal user tokens stored with no expiry                           | Redis with auth and per-agent key prefixes; no personal tokens stored; conversations expire                           |
| Full prompts, replies and tool outputs logged with no retention and readable by every user      | Logs carry run IDs and outcomes only; tool output is redacted before it reaches a model or Telegram                   |
| Usage and "hours saved" are tracked per person by email                                         | Metrics describe the system (runs, cost, outcomes), never people                                                      |
| "Hours saved" is a model's estimate presented as a metric                                       | Only measured values: cost, tokens, duration, outcome                                                                 |
| One pod, ephemeral disk, tests disabled in CI                                                   | Stateless services, state in Postgres and Redis; every agent and the core gated by tests in the required `ci` check   |
| A 1,300-line service class holds the loop and most logic                                        | A small core with hexagonal modules; agent logic lives in its own app                                                 |

---

## Layout

```
packages/
  ai-core/                @ratingo/ai-core   platform library, no agent knowledge
apps/ai/
  veronica/               @ratingo/ai-veronica   digest, investigations, Telegram chat and router
  happy/                  @ratingo/ai-happy      GitHub PR review
  dume/                   @ratingo/ai-dume       later: read-only search
```

- **Each agent is its own Railway service** with its own environment. A process only holds the credentials of the agent it runs. Happy reads untrusted PR content, so it must not share a process with Grafana, GA4 or database credentials.
- **Agents import only `@ratingo/ai-core`**, never each other. When the chat router in Veronica needs Happy, it calls Happy's service over the Railway private network with a service token; Happy runs the request with Happy's own credentials, model and budget.
- `@ratingo/ai-core` is built like `@ratingo/node-telemetry`: tooling reads `src`, compiled apps load `dist`, and each agent Dockerfile copies it.

### What `@ratingo/ai-core` contains

| Area                      | Contents                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Neutral model types       | `ChatMessage`, `ToolDefinition`, `ToolCall`, `ToolResult`, `StopReason`, `ModelUsage`, `ResponseSchema`, `ModelCapabilities` |
| `MODEL_PORT` and adapters | Stub and Anthropic first; OpenAI-compatible and Ollama when needed                                                           |
| Model config              | Aliases (`fast`, `review`, `smart`) mapped to `provider:model`, price table, fallback lists                                  |
| Tools                     | `defineTool` (zod schema, handler, `readOnly`, output cap), tool registry, MCP client source, skills loader                  |
| Agent loop                | Turns, budgets, stop reasons, structured output                                                                              |
| Run log                   | `Run` aggregate and `RUN_REPOSITORY` port                                                                                    |
| Manifests                 | zod schemas for `agent.yaml` and task frontmatter, validated at boot                                                         |
| Telemetry                 | Metric names for `app.ai.*`                                                                                                  |

### What an agent app contains

```
apps/ai/veronica/
├── src/
│   ├── main.ts               # HTTP: Telegram webhook, internal API, health
│   ├── config/               # Joi env schema
│   └── modules/
│       ├── digest/           # collectors, rules, template; METRICS/ANALYTICS/PRODUCT_STATS ports
│       ├── chat/             # Conversation aggregate, router, confirmations
│       ├── investigation/    # read-only tools over the digest ports
│       └── notify/           # NOTIFIER_PORT, Telegram adapter
├── agent/                    # agent.yaml, prompts/, tasks/*.md, skills/
├── drizzle/                  # migrations for the `ai` schema
└── Dockerfile
```

Happy follows the same shape with `review/` (`CODE_HOST_PORT`, GitHub App adapter) instead of `digest/`, `chat/` and `notify/`.

---

## Architecture rules

Every app and the core follow the repo's Clean/Hexagonal rules (`presentation → application → domain ← infrastructure`, ports in `domain/ports/*.port.ts` with a `Symbol` token, adapters in `infrastructure/adapters/*.adapter.ts`, `public/index.ts` barrels, `CLOCK_PORT`, `as const` constants, domain errors, property-based tests for domain logic).

Today those rules are scoped to `apps/api` only: `.claude/rules/*.md` by their `paths:` frontmatter, and the layer boundaries in `eslint.config.mjs`. Before the first agent code lands, both are extended to `apps/ai/**` and `packages/ai-core/**`.

### Aggregates

| Aggregate                 | Owner                     | Store                                              |
| ------------------------- | ------------------------- | -------------------------------------------------- |
| `Run`                     | core, used by every agent | Veronica: `ai.runs`; Happy: metrics and logs only  |
| `Conversation`            | Veronica `chat`           | Redis, TTL                                         |
| `ReviewState` (repo + PR) | Happy `review`            | Hidden marker in Happy's summary comment on the PR |

They reference each other only by id. Happy keeps its review state on GitHub and records its runs through the telemetry adapter of `RUN_REPOSITORY`, so Happy needs no database access at all.

### Ports

| Port                      | Owner             | First adapter                                       |
| ------------------------- | ----------------- | --------------------------------------------------- |
| `MODEL_PORT`              | core              | Stub, Anthropic                                     |
| `TOOL_SOURCE_PORT`        | core              | Native tools, MCP client, skills                    |
| `RUN_REPOSITORY`          | core              | Postgres (`ai` schema); telemetry-only for Happy    |
| `CLOCK_PORT`              | core              | System clock; fixed clock in tests                  |
| `METRICS_PORT`            | Veronica `digest` | Grafana Cloud Prometheus                            |
| `ANALYTICS_PORT`          | Veronica `digest` | GA4 Data API                                        |
| `PRODUCT_STATS_PORT`      | Veronica `digest` | Postgres `reporting` views                          |
| `NOTIFIER_PORT`           | Veronica `notify` | Telegram                                            |
| `CONVERSATION_REPOSITORY` | Veronica `chat`   | Redis                                               |
| `AGENT_GATEWAY_PORT`      | Veronica `chat`   | HTTP to other agent services                        |
| `CODE_HOST_PORT`          | Happy `review`    | GitHub App: diff, files at a ref, review, check run |

Investigation tools wrap the digest ports; they never open their own clients.

---

## Models: provider-agnostic

The core never imports a provider SDK outside its adapters.

- **Aliases, not model names.** Agents and tasks ask for an alias; env maps it:

  ```
  AI_MODEL_FAST=anthropic:claude-haiku-5-5
  AI_MODEL_REVIEW=anthropic:claude-sonnet-5-5
  AI_MODEL_SMART=anthropic:claude-opus-5-5
  ```

  Switching provider is a config change once an adapter for it exists.

- **Neutral stop reasons:** `end`, `tool_use`, `max_tokens`, `refusal`, `paused`. Each adapter maps its provider's values.
- **Usage** carries input, output, cache-read, cache-write and reasoning tokens; the price table has a rate for each.
- **Structured output** uses a neutral `ResponseSchema`. Each adapter picks its strategy (native JSON schema, tool-shaped output, or Ollama `format`); the result is always validated with zod, with one repair attempt.
- **Capabilities are flags** (prompt caching, thinking, images, structured output). The core works without them.
- **Calls are non-streaming** with an explicit `max_tokens` and a per-call timeout, which keeps the adapter contract small. Streaming is added in an adapter if a use case needs it.
- **Fallback** to the next model in the alias's list happens only on transport errors, 5xx and 429, and only before the first turn, or by restarting the run from scratch. A refusal is a stop reason, never a reason to try another provider. A run never switches provider mid-transcript.
- **Retries do not stack.** Adapter retries are bounded and counted; BullMQ attempts wrap the whole run; fallback is a separate, logged step.

---

## Tools, skills and MCP

- A tool is defined once with `defineTool`; adapters translate it to each provider's format.
- An agent sees only the tools its manifest lists. Anything not listed is denied.
- **Skills** are a prompt plus the tools they bring. The system prompt lists names and one-line descriptions; the model loads a skill's body on demand.
- **MCP servers** must be on a platform-level allowlist with pinned versions. MCP subprocesses get an explicit, minimal environment, never the parent's `process.env`. Their output is untrusted data.
- Tool output is capped, and secrets and personal data are redacted before it reaches a model or Telegram.
- No shell tool. Nothing runs code from a PR or from model output.

---

## The agent loop

`AgentLoop.run(run)` in the core:

- calls `MODEL_PORT`, runs requested tools, feeds results back, until a final answer or a stop reason
- before each call, checks the budget against the worst case at `max_tokens`, so one call cannot overshoot
- stops at `maxTurns`, budget or wall-clock timeout, and records the stop reason
- writes the `Run` after every turn (status, turns, tokens, cost, stop reason); transcripts are not stored, so a run interrupted by a restart is marked `interrupted` and reported, not resumed

Used only where the model must decide what to look at: investigations, chat and review. Digest numbers never go through it.

### Budgets

- Levels: per call (worst case), per run, per task, per agent per day. **The strictest one wins.**
- Hitting the daily cap stops model calls for that agent until the next day. The digest still goes out, without model text.
- Happy has a per-PR and a per-day budget.

### Manifests and tasks

```yaml
name: veronica
models: { default: fast }
tools: [prom_query, loki_query, queue_state, ga4_report, product_stats]
skills: [ratingo-queues, ratingo-external-apis]
mcp: []
budgets: { perRunUsd: 0.05, perDayUsd: 0.5 }
```

```markdown
---
schedule: '0 9 * * *'
timezone: Europe/Kyiv
model: fast
budgetUsd: 0.02
---

Write the headline and action lines for today's digest from the snapshot below...
```

Manifests and task frontmatter are validated with zod at boot; an invalid file stops the service from starting. Credentials are not listed in manifests: each service's Joi env schema declares exactly the variables it needs.

Tasks are registered with `upsertJobScheduler` and the task's own `tz`, on a queue with its own prefix (`ai-veronica`) on the shared Redis. On boot, schedulers whose task files were deleted are removed, the same way `apps/api` cleans up its ingestion schedulers.

---

## Veronica: the daily digest

A pipeline, not a conversation. Code produces every number; the model writes only words.

```
collectors → snapshot + source status → rules → template → model text → Telegram
```

1. **Collectors** query the digest ports for the 24h window (Kyiv day boundaries converted to UTC explicitly) and the same window a week earlier. Each source reports `ok` or `unavailable` with a reason.
2. **Rules** assign `action`, `note` or `ok`. Severity follows impact, not counts: Trakt 429s that all succeeded on retry are a `note`. Expected noise, like 404s from TVMaze or MDBList for titles they do not have, is never an alert. Thresholds and minimum volumes live in config. Rules are pure functions with fast-check tests.
3. **Template** renders Telegram HTML: verdict first, numbered actions, one line per block (people, catalog, site, background jobs, keys/backup/database), details in an expandable blockquote, source status and run cost in the footer. Quiet days are sent silently.
4. **Model text:** the model gets the snapshot and returns structured text for the headline, action wording and one "interesting" line. It never produces numbers. If the model is unavailable or over budget, the digest goes out with template text only.
5. **Buttons** start an investigation run with read-only tools, answered as a reply with its turns and cost.

Digest rules: verdict first; actions instead of observations; plain words; every number has a baseline; product before infrastructure; a missing source is shown as missing, never as zero.

**Failure modes:**

- The digest records a `sent` state per date, so a retry after a successful send never posts twice.
- If Telegram is down, delivery retries with backoff until the end of the morning window.
- The digest is sent every day, including quiet days. A Grafana alert fires when no successful digest run happened in the last 26 hours.

### Data access

- **Grafana:** a service account with the Viewer role.
- **Postgres:** `apps/api` migrations own a `reporting` schema of views that return aggregates only, with no emails or per-user rows. The view schema is the contract; an API migration that would break it has to change the view.
- **Roles:** `ai_reader` has `SELECT` on `reporting` only. `ai_writer` owns the `ai` schema (`ai.runs`) and nothing else.
- **Migrations** for the `ai` schema live in `apps/ai/veronica/drizzle`, with their own journal (`migrations: { schema: 'ai', table: '__drizzle_migrations' }`, `schemaFilter: ['ai']`) so they never collide with the API's journal. They run in the Veronica service's Railway pre-deploy step. Every statement is safe to re-run.

### Prerequisite in `apps/api`

Per-job counters reset on every deploy, so a job that runs once a day looks like it never ran. Before the digest reports on schedules, `apps/api` exports `app.scheduler.last_run_timestamp_seconds` per job with a `result` attribute, matching `app.backup.last_run_timestamp_seconds` from `apps/pg-backup`. Until then, the digest says nothing about nightly jobs.

---

## Veronica: chat and routing

The Telegram bot runs in webhook mode (polling breaks with more than one replica) with Telegram's secret token header. It answers only when **both** the user ID and the chat ID are on the allowlist.

```
"Veronica, why did trending not update?"           → Veronica investigation
"Happy, review https://github.com/.../pull/431"    → Happy, that PR
"find where we call MDBList and how often it 429s"  → router decides
```

Routing, cheapest first:

1. **Commands:** `/digest`, `/review <PR>`, `/ask <agent> <question>`.
2. **Mentions:** a message starting with an agent's name or alias.
3. **Patterns:** a GitHub PR link goes to Happy. Patterns live in config.
4. **Router:** only when nothing matches. A small run on the `fast` alias whose only tools are the other agents (`ask_happy`, later `ask_dume`) plus Veronica's own investigation. It passes a clear brief, or asks back when the request is ambiguous.

Rules:

- **Event routing stays deterministic:** the schedule starts the digest, GitHub webhooks start Happy, buttons start the run they belong to. No model decides who handles an event.
- **Agents keep their boundaries.** `ask_happy` is an HTTP call to Happy's service. The router holds no GitHub credentials.
- **Conversations:** a Telegram reply thread is one `Conversation`, kept in Redis with a TTL. It holds message text, which is why it expires.
- **Confirmation for writes:** anything that changes state outside the bot (posting a review, re-running a job, opening an issue) is offered as a button. The button carries an opaque single-use ID that maps to a pending action stored server-side with an expiry, never the action itself.
- `/review` and the router act only on configured repositories.

---

## Happy: code review

1. **Webhook:** GitHub App events `pull_request` (`opened`, `synchronize`, `ready_for_review`). The signature is checked against the raw body, the delivery ID is de-duplicated, and the handler returns 2xx at once after enqueueing a job.
2. **Coalescing:** one job per PR (`jobId` per repo and PR, short delay), so a burst of pushes produces one review of the latest commit; a stale run is cancelled.
3. **Scope:** drafts are skipped. Only PRs from the same repository or from allowlisted authors are reviewed, so a fork PR cannot spend the budget.
4. **Incremental diff:** the hidden state marker records the last reviewed commit and posted finding fingerprints; only new changes are reviewed.
5. **Filtering:** lockfiles, generated `packages/api-contract` types, snapshots and migration metadata are skipped.
6. **Rules from the base branch.** `CLAUDE.md`, `.claude/rules/*.md` (matched by their `paths:` frontmatter), prompts and config are always read from the PR's base branch. Anything from the PR head is untrusted data inside clear delimiters, never instructions.
7. **Findings:** structured output (file, line, severity, message, suggestion). Code checks every line against the diff hunks and drops the rest.
8. **Posting:** one review with event `COMMENT` only, never `APPROVE` or `REQUEST_CHANGES`, plus a summary comment updated in place. Model text is stripped of `@mentions`, images and external links before posting.
9. **Shadow mode first:** Happy posts only a check run with a `neutral` conclusion while CodeRabbit keeps reviewing. CodeRabbit is turned off once Happy finds as many real issues with less noise.

Model: `review` alias. A cheap first pass on `fast` can mark risky files so the larger model reads only those. GitHub App permissions: `contents: read`, `pull_requests: write`, `checks: write`.

---

## Security summary

- One service per agent, one credential set per service, declared by its Joi env schema.
- Least privilege everywhere: Grafana Viewer, `ai_reader` on `reporting` views only, a GitHub App with three scoped permissions, Telegram user and chat allowlist.
- Untrusted input (PR content, logs, MCP output, chat text) is data, never instructions. Happy cannot act on an injected instruction beyond writing a `COMMENT`.
- Deny by default: a check that cannot complete denies the action.
- Budgets at every level, strictest wins.

---

## Observability

- Each service bootstraps its own OpenTelemetry SDK the way `apps/api/src/telemetry` does and uses `@ratingo/node-telemetry` conventions.
- Metrics: `app.ai.runs` (agent, task, trigger, outcome), `app.ai.run.cost` (USD), `app.ai.run.tokens` (kind), `app.ai.run.duration`, `app.ai.tool.calls`.
- Logs carry run IDs and outcomes, not prompts, PR content or chat text.
- A `Ratingo / AI` Grafana dashboard, plus the missing-digest alert.

---

## Repository changes

Before the first agent code lands:

- Root `package.json` workspaces add `apps/ai/*` (today only `apps/*` and `packages/*`).
- `knip.json`: workspaces for `packages/ai-core` and each agent.
- `.github/workflows/ci.yml`: path outputs `ai-core` and one per agent (each also triggered by `packages/ai-core/` and `packages/node-telemetry/`); lint, typecheck, tests and build jobs; a migrations check for `apps/ai/veronica/drizzle`; agent Dockerfiles in the `deps` pattern; prod-install and audit checks; every new job added to the `ci` aggregator's `needs`.
- `eslint.config.mjs` layer boundaries and `.claude/rules/*.md` `paths:` extended to the new folders.
- `CLAUDE.md` Layout and CI sections updated.

---

## Testing

- Stub model scenarios: normal run, runaway loop, tool error, budget exceeded, refusal, transport failure with fallback.
- Adapter contract tests: every `MODEL_PORT` adapter passes the same suite on recorded responses.
- fast-check tests for digest rules and budget arithmetic.
- Golden tests for the Telegram template on green, yellow and red days.
- Review eval set: past PRs with known issues, scored before every prompt or model change.
- Each step follows the repo's review routine: `code-review`, `clean-code`, `clean-ddd-hexagonal`.

---

## Rollout

1. **Repo groundwork:** workspaces, CI, lint boundaries, rules scope. `@ratingo/ai-core` with neutral types, Stub and Anthropic adapters, loop, budgets, run log, telemetry.
2. **Veronica digest:** `reporting` views, collectors, rules, template, Telegram, daily schedule; the scheduler gauge in `apps/api`. Railway dev first, production after a week.
3. **Investigation buttons.**
4. **Happy in shadow mode.**
5. **Happy live,** CodeRabbit off.
6. **Chat:** commands, mentions, patterns, then the router.
7. **DUM-E:** read-only search across code, logs, metrics and data, as its own service.
8. **Later:** weekly digest, instant alerts without a model, more adapters.

---

## Consequences

- Two Railway services now, three with DUM-E. Each is a small Node process.
- The core and adapters are ours to maintain; in exchange nothing is tied to one provider or framework, and every step is visible.
- Neutral types cover what providers share; provider-specific features come through capability flags.
- The digest is only as good as its metrics; missing metrics are fixed at the source.

## Open questions

- Which GA4 metrics count as "active users".
- One private chat, or a channel for history.
- Whether Ollama is ever used in production or only locally.
