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
| Tools                     | `defineTool` (zod schema, handler, `readOnly`, output cap), tool registry, untrusted-data wrapper, skills loader             |
| MCP gateway               | Platform allowlist of MCP servers, per-tool policy, stdio transport, sessions, bridge into the tool registry                 |
| Agent loop                | Turns, budgets, stop reasons, structured output                                                                              |
| Run log                   | `Run` aggregate and `RUN_REPOSITORY` port                                                                                    |
| Manifests                 | zod schemas for `agent.yaml` and task frontmatter, validated at boot                                                         |
| Telemetry                 | Metric names for `app.ai.*`                                                                                                  |

## File structure

Naming follows what the repo already does: `apps/api` for NestJS modules, `packages/node-telemetry` for framework-free packages, `apps/pg-backup` for small services.

- Files: `kebab-case.<role>.ts`, where role is `port`, `adapter`, `repository`, `service`, `worker`, `controller`, `module`, `constants`, `schema`, `tool`, `rule`, `collector`, `mapper`, `template`.
- Tests sit next to the file: `*.test.ts` in packages, `*.spec.ts` in Nest apps, like today.
- Ports are named after what the domain needs (`metrics.port.ts`), adapters after the technology plus the port (`prometheus.metrics-adapter.ts`).

### `packages/ai-core`

Framework-free like `@ratingo/node-telemetry`: no Nest imports, no `process.env`; apps pass config in. Organised by capability; each folder keeps its port next to its adapters.

```
packages/ai-core/
├── package.json · tsconfig.json · tsconfig.build.json · jest.config.cjs
└── src/
    ├── index.ts                        # the only public entry
    ├── model/
    │   ├── model.port.ts               # ModelPort, MODEL_PORT
    │   ├── model.types.ts              # ChatMessage, ToolCall, StopReason, ModelUsage, ResponseSchema, ModelCapabilities
    │   ├── model-ref.ts                # "provider:model" parsing, aliases
    │   ├── model-pricing.ts
    │   ├── model-fallback.ts           # transport/5xx/429 only, before the first turn
    │   └── adapters/
    │       ├── anthropic/
    │       │   ├── anthropic.model-adapter.ts
    │       │   └── anthropic.mapper.ts
    │       └── stub/
    │           ├── stub.model-adapter.ts
    │           └── stub.scenarios.ts   # normal, runaway, tool-error, refusal, budget, transport-failure
    ├── tools/
    │   ├── define-tool.ts
    │   ├── tool-registry.ts            # manifest allowlist, output caps
    │   ├── tool-source.port.ts
    │   ├── redact.ts
    │   ├── untrusted-content.ts        # <untrusted> wrapper that cannot be closed from inside
    │   └── sources/
    │       ├── native.tool-source.ts
    │       └── skill.tool-source.ts    # names in context, body on demand
    ├── mcp/
    │   ├── mcp-server.definition.ts    # server definition, validation (pinned version, env keys, policy)
    │   ├── mcp-server.registry.ts      # platform allowlist, explicit env per server
    │   ├── platform-mcp-servers.ts     # the allowlist itself
    │   ├── mcp-tool-policy.ts          # pure: allow, pin, constrain, shape the schema
    │   ├── mcp-transport.port.ts       # McpTransport, MCP_TRANSPORT_PORT
    │   ├── mcp-telemetry.port.ts       # McpTelemetry, MCP_TELEMETRY_PORT
    │   ├── mcp-session.ts              # lazy start, idle stop, one restart, cooldown
    │   ├── mcp-tool-bridge.ts          # MCP tool → ai-core Tool
    │   ├── mcp.tool-source.ts
    │   ├── mcp-gateway.ts              # what an agent wires
    │   └── adapters/
    │       ├── stdio/                  # official SDK client over our explicit-env stdio transport
    │       └── otel/                   # app.ai.mcp.* metrics
    ├── loop/
    │   ├── agent-loop.ts
    │   ├── budget.ts                   # worst-case pre-check, strictest level wins
    │   └── structured-output.ts        # zod validation, one repair attempt
    ├── runs/
    │   ├── run.ts                      # Run aggregate
    │   ├── run.repository.ts           # RUN_REPOSITORY port
    │   └── telemetry.run-repository.ts # metrics and logs only
    ├── manifest/
    │   ├── agent-manifest.schema.ts
    │   ├── task.schema.ts
    │   └── agent-folder.loader.ts      # reads agent/, validates, fails fast
    ├── clock/
    │   └── clock.port.ts
    └── telemetry/
        └── ai-metric-names.ts          # app.ai.*
```

### `apps/ai/veronica`

NestJS + Fastify, modules shaped like `apps/api/src/modules/*`. `agent/` holds everything specific to Veronica that is not code.

```
apps/ai/veronica/
├── package.json · nest-cli.json · tsconfig*.json · jest.config.js · Dockerfile · drizzle.config.ts
├── drizzle/                            # `ai` schema migrations, own journal
├── agent/
│   ├── agent.yaml
│   ├── prompts/
│   │   ├── system.md
│   │   ├── digest-text.md
│   │   ├── investigation.md
│   │   └── router.md
│   ├── tasks/
│   │   └── daily-digest.md
│   └── skills/
│       ├── ratingo-queues/SKILL.md
│       └── ratingo-external-apis/SKILL.md
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── config/
    │   ├── env.schema.ts               # Joi, only Veronica's variables
    │   ├── models.config.ts            # aliases, prices, fallbacks
    │   └── digest.config.ts            # thresholds, minimum volumes
    ├── telemetry/
    │   └── telemetry.sdk.ts
    ├── database/
    │   └── schema.ts                   # ai.runs
    ├── core/
    │   └── ai-core.module.ts           # Nest wiring for @ratingo/ai-core: MODEL_PORT, tools, loop, runs
    └── modules/
        ├── digest/
        │   ├── digest.module.ts · digest.constants.ts · public/index.ts
        │   ├── domain/
        │   │   ├── entities/snapshot.ts · digest-item.ts
        │   │   ├── constants/digest-level.constants.ts      # action, note, ok
        │   │   ├── ports/metrics.port.ts · analytics.port.ts · product-stats.port.ts
        │   │   └── rules/queues.rule.ts · freshness.rule.ts · external-apis.rule.ts · site.rule.ts · backup.rule.ts
        │   ├── application/
        │   │   ├── collectors/queues.collector.ts · site.collector.ts · people.collector.ts · catalog.collector.ts · infra.collector.ts
        │   │   ├── services/digest.service.ts · digest-scheduler.service.ts
        │   │   └── workers/digest.worker.ts
        │   └── infrastructure/
        │       ├── adapters/prometheus.metrics-adapter.ts · ga4.analytics-adapter.ts · reporting.product-stats-adapter.ts
        │       └── templates/telegram-digest.template.ts
        ├── investigation/
        │   ├── investigation.module.ts · public/index.ts
        │   ├── application/
        │   │   ├── services/investigation.service.ts
        │   │   └── tools/prom-query.tool.ts · loki-query.tool.ts · queue-state.tool.ts · product-stats.tool.ts
        │   └── infrastructure/adapters/loki.logs-adapter.ts
        ├── chat/
        │   ├── chat.module.ts · chat.constants.ts · public/index.ts
        │   ├── domain/
        │   │   ├── entities/conversation.ts · intent.ts · pending-action.ts
        │   │   ├── policies/allowlist.policy.ts · command-parser.policy.ts · mention-parser.policy.ts · pattern-router.policy.ts
        │   │   └── ports/conversation-store.port.ts · pending-action-store.port.ts · happy-client.port.ts
        │   ├── application/
        │   │   ├── services/chat.service.ts · investigation.runner.ts
        │   │   ├── commands/                                # one handler per command
        │   │   └── workers/chat.worker.ts
        │   ├── infrastructure/
        │   │   ├── stores/redis.conversation-store.ts · redis.pending-action-store.ts
        │   │   └── adapters/http.happy-client.ts
        │   └── presentation/telegram-webhook.controller.ts
        ├── notify/
        │   ├── notify.module.ts · public/index.ts
        │   ├── domain/ports/notifier.port.ts · chat-transport.port.ts · webhook-admin.port.ts
        │   └── infrastructure/adapters/telegram.notifier-adapter.ts · telegram.chat-adapter.ts
        └── runs/
            ├── runs.module.ts · public/index.ts
            └── infrastructure/repositories/postgres.run-repository.ts
```

### `apps/ai/happy`

Same shape, one domain module. No `database/` and no `drizzle/`: review state lives on GitHub.

```
apps/ai/happy/
├── package.json · nest-cli.json · tsconfig*.json · jest.config.js · Dockerfile
├── agent/
│   ├── agent.yaml
│   └── prompts/
│       ├── review.md
│       └── triage.md
└── src/
    ├── main.ts · app.module.ts
    ├── config/env.schema.ts · models.config.ts · review.config.ts   # repos, author allowlist, skip patterns
    ├── telemetry/telemetry.sdk.ts
    ├── core/ai-core.module.ts
    └── modules/review/
        ├── review.module.ts · review.constants.ts · public/index.ts
        ├── domain/
        │   ├── entities/review-state.ts · finding.ts · pull-request.ts
        │   ├── constants/severity.constants.ts · skip-patterns.constants.ts
        │   ├── ports/code-host.port.ts
        │   └── policies/rule-selector.ts · finding-validator.ts · finding-fingerprint.ts · output-sanitizer.ts
        ├── application/
        │   ├── services/review.service.ts · ask-review.service.ts
        │   └── workers/review.worker.ts                     # one job per PR, coalesced
        ├── infrastructure/
        │   ├── adapters/github-app.code-host-adapter.ts
        │   ├── mappers/github.mapper.ts
        │   └── state/review-state-marker.codec.ts           # hidden marker in the summary comment
        └── presentation/controllers/github-webhook.controller.ts · internal-review.controller.ts
```

`internal-review.controller.ts` is what Veronica's `ask_happy` calls over the private network.

### `apps/ai/dume` (later)

Same shape with a `search/` module and read-only tools over code, logs, metrics and the `reporting` views.

### Placement rules

- Anything two agents need goes to `packages/ai-core`, never into one agent to be imported by another.
- An agent-specific integration stays in that agent, even if it might be reused later; it moves to the core on the second real use.
- Prompts, tasks and skills live in `agent/`, never in `src/`. Code does not contain Ratingo hosts, IDs or chat IDs.
- Domain folders (`domain/`) depend on nothing outside the module and `@ratingo/ai-core` types.

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
| `TOOL_SOURCE_PORT`        | core              | Native tools, MCP gateway, skills                   |
| `MCP_TRANSPORT_PORT`      | core              | stdio (official SDK client, explicit env)           |
| `MCP_TELEMETRY_PORT`      | core              | OpenTelemetry `app.ai.mcp.*`                        |
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
- Tool output is capped, and secrets and personal data are redacted before it reaches a model or Telegram.
- No shell tool. Nothing runs code from a PR or from model output.

### MCP gateway (`packages/ai-core/src/mcp`)

MCP servers are reached only through the gateway. The rules:

- **Platform allowlist.** A server exists only if it is in `PLATFORM_MCP_SERVERS` in ai-core, reviewed like code. Each definition names the server, its launch command and args with one **pinned version** (validated: no ranges or tags, and the version must appear in the command or args), the env keys it may receive, timeouts (`startMs`, `callMs`, `idleTtlMs`, `restartCooldownMs`) and a tool policy. An agent's `agent.yaml` `mcp: [...]` may only name registered servers; `loadAgentFolder(..., { knownMcpServers })` fails boot on any other name.
- **Explicit environment.** The subprocess env is built only from the definition: `constants` plus the `required`/`optional` keys taken from the config the agent passes in. Nothing is inherited from `process.env`, not even `PATH` or `HOME` (the SDK's own stdio transport always copies those, so ai-core uses its own stdio transport with the SDK client). If a required key is missing, the server is `unconfigured`: its tools are not registered and a telemetry event says which keys are missing.
- **Tool policy (pure domain).** Per server: an allowlist of remote tools, each with a code-written description (server descriptions are untrusted and never shown to the model), pinned arguments that are removed from the schema the model sees and always overwrite whatever the model sends, argument constraints (`number` with min/max/default, `one_of` for strings or string lists, `max_items`, `date_ranges` with a lookback and span window) and an output cap. A `number` constraint must have a default, so a cap cannot be bypassed by leaving the argument out. An argument the remote tool does not declare is refused, and the schema shown to the model has `additionalProperties: false`. A call that breaks a rule gets a JSON refusal (`status: "refused"`, `code`, `argument`, `message`) and never reaches the server.
- **Bridge.** Each allowed tool becomes an ordinary ai-core `Tool` named `<server>__<tool>` (server names have no underscore, so the name splits back unambiguously), `readOnly: true`. A tool the server annotates as not read-only or destructive is never bridged, even if the policy lists it. Its output is capped, wrapped in `<untrusted label="mcp <name>">`, then redacted and capped again by the tool registry.
- **Sessions.** The first run that builds a registry lists the tools, which starts the server once; there is no boot-time warm-up. The listing is kept for the life of the process, since it belongs to the pinned version, so later runs bridge the tools without a live process and only a real call starts the server again. Every call has a timeout, and a call that times out closes that process so the next call gets a fresh one. An idle server is stopped after `idleTtlMs`, a crash mid-call gets one restart and one retry, a failed start or failed restart cools down for `restartCooldownMs`, and `McpGateway.close()` stops every subprocess (the stdio transport also kills its child if the parent exits).
- **Failure is an answer, not an exception.** A server that is down, slow or crashed yields `status: "unavailable"` for that call and the run continues. A server that cannot list its tools offers none for that run. The agent passes `gateway.expectedToolNames()` as `optionalTools` to `ToolRegistry.create`, so a missing MCP tool is left out and reported by `unavailableTools()` instead of failing the registry. Every case is counted in telemetry.
- **Telemetry.** `app.ai.mcp.calls` and `app.ai.mcp.call.duration` by `server`, `tool`, `outcome` (`ok`, `tool_error`, `refused`, `timeout`, `unavailable`), and `app.ai.mcp.server.events` by `server`, `event` (`started`, `start_failed`, `crashed`, `restarted`, `idle_stopped`, `unconfigured`, `tool_missing`, `tool_not_read_only`, `tool_list_truncated`, `policy_argument_undeclared`, `recycled_after_timeout`), plus an `ai.mcp.server_event` log line with a redacted detail.
- **Transports.** Only stdio today, behind `MCP_TRANSPORT_PORT`; streamable HTTP is a second adapter when a server needs it.

How to add a server and its policy: `packages/ai-core/README.md`. Registered servers: `google-analytics` (Google's `analytics-mcp` 1.1.0, used by Veronica's chat).

**Credentials for a file-based server.** `analytics-mcp` reads its service account key from a file path. Railway gives env values, so Veronica takes the key JSON from `GA_CREDENTIALS_JSON` and checks that it parses as a service account key, without logging it. At boot it writes the key to a private temp directory (`0700`, file `0600`, never in the repo or the image), passes only the path, and deletes the directory on shutdown.

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

The Telegram bot runs in webhook mode (polling breaks with more than one replica). Deterministic code comes first; the model answers only free-form questions.

```
"/status"                                            → command, no model
"Veronica, why did trending not update?"             → investigation agent
"Happy, review https://github.com/.../pull/431"      → Happy, that PR
"how many people signed up this week?"               → free-form question → investigation agent
```

### Principles

- **Deterministic first.** Commands, mentions and patterns are plain code. The model is for free-form questions only.
- **Veronica is read-only.** A write happens only after a confirm button.
- **Agents keep their boundaries.** `ask_happy` is an HTTP call to Happy over the Railway private network with `HAPPY_SERVICE_TOKEN`. Veronica holds no GitHub write credentials.
- **The webhook answers at once and the work runs in a queue.** Telegram never waits for a run.

### Flow

1. Telegram sends `POST /webhooks/telegram` through the Cloudflare WAF, which allows only that path (plus `GET /` and `/health`).
2. The service verifies the secret header, then the allowlist: the sender's user ID **and** the chat ID, and the chat is private.
3. It enqueues a BullMQ `chat` job (prefix `ai-veronica`, job id from the Telegram `update_id`) and returns 200 at once. A wrong secret gets 401; an unknown user, chat or update type gets 200 and is ignored, so the webhook reveals nothing about the allowlist.
4. The worker routes the message, cheapest first: command → mention → pattern (a GitHub PR link goes to Happy) → free-form → investigation agent. A Happy mention or a PR link never reaches a model (see "Happy through Veronica").
5. It replies with sanitized Telegram HTML and records an `ai.runs` row (`trigger = chat`).

The webhook secret is derived, not configured: `base64url(HMAC-SHA256(TELEGRAM_BOT_TOKEN, "ratingo-telegram-webhook"))`. It fits Telegram's charset and length, and rotating the bot token rotates it. On boot, when `TELEGRAM_WEBHOOK_URL` is set, the service registers the webhook (`allowed_updates: ["message"]`, `drop_pending_updates: false`) unless `getWebhookInfo` already matches.

### Module layout `modules/chat`

- **domain:** `Conversation`, `Intent`, `PendingAction`; policies `allowlist`, `command-parser`, `mention-parser`, `pattern-router`, `happy-target`, `happy-summary`, `happy-follow-up`; ports `CHAT_TRANSPORT`, `CONVERSATION_STORE`, `PENDING_ACTION_STORE`, `HAPPY_CLIENT`. `CHAT_TRANSPORT` and the webhook admin port live in `modules/notify` next to the Telegram adapter; the chat module consumes them through `notify/public`.
- **application:** `chat.service`, command handlers, `investigation.runner`, the BullMQ worker.
- **infrastructure:** Telegram adapter (extends `notify`), Redis stores with TTL, Happy HTTP client.
- **presentation:** `telegram-webhook.controller`.

### Commands

`/help`, `/digest` (builds and sends today's digest now through the digest pipeline without touching the daily `sent` claim, marked as on-demand), `/status` (one screen: block levels from the same rules engine), `/queues` and `/site` (those blocks in detail), `/last` (the last three non-command exchanges of this chat: question → outcome, cost). Free text and mentions of Veronica go to the investigation agent (step 2). A Happy mention with a PR number and a link to a PR of the configured repository go to Happy (step 3). `/help` lists them.

### Investigation tools (read-only)

- `metrics_query`: only named PromQL templates with parameters, a window of at most 7 days, capped output. No free-form PromQL.
- `product_stats`: the `reporting` views through `ai_reader`.
- `digest_snapshot`: today's snapshot and rule outcomes.
- `recent_changes`: deploys and merged PRs, read-only.
- `ask_happy`: reads Happy's latest finished result for one PR (verdict, counts by severity, questions, coverage). It never starts a review.
- `google-analytics__run_report`, `google-analytics__run_realtime_report`, `google-analytics__get_custom_dimensions_and_metrics`: Google Analytics 4 for ratingo.top through the MCP gateway (`mcp: [google-analytics]`). The property is pinned from `GA_PROPERTY_ID`, reports go at most 90 days back with at most 50 rows, and paging and quota arguments are hidden. They are optional tools, and a run never waits for them: Veronica lists them in the background at boot (`McpGatewayHost.onApplicationBootstrap`), and a run offers them only once that listing is ready, so the first questions after a deploy are answered without them. If listing fails, the next run starts another listing in the background, and the session's cooldown keeps this from spawning the server on every message. when the key or the property id is missing or invalid, or the server is down, they are simply not offered and the chat works as before. Their prompt (`agent/prompts/chat-google-analytics.md`) is added only when they are offered.

No Railway logs and no free SQL; those are left to DUM-E later.

`ask_happy` ships in step 3; the other four shipped in step 2. `metrics_query` templates: `queue_throughput`, `queue_backlog_peak`, `http_client_errors`, `site_requests`, `site_latency_p95`, `site_memory_peak`, `scheduler_last_runs`, `backup_status`, `infra_health`. Their PromQL lives in `digest/domain/queries/prom-queries.ts`, shared with the digest collectors. Parameters are validated (queue and provider names, a three-digit status, a window from 1 hour to 7 days, an offset of 0 to 14 days) before they reach a query.

### Investigation run (step 2)

- One `AgentLoop` per message on alias `fast`, with a registry of just these four tools, prompt `agent/prompts/chat.md`, at most 8 turns and $0.05 per message; $0.30 per day for the `chat` task and the agent's day budget, both read from the `ai.runs` table.
- «шукаю…» is posted first and then edited into the answer; if the edit fails, a new message is sent.
- **Numbers guard.** Every number in the answer must appear in this run's tool results, the question, the last turns or the clock line. A date counts as verified only where the answer writes it as a date or a date range («20 листопада», «з 15 по 21 листопада», «15–21.11»), and each date must be a row date from GA or an end of a date range this run requested, resolved against Kyiv's today. A bare day or month never passes as a count. A sentence with another number is cut and a note is added; if nothing is left, the raw snapshot is sent. Links are stripped.
- **Fallback.** When the model is down, over budget or its numbers cannot be verified, the reply is the `/status` snapshot with one line saying why.
- **Memory.** The last 12 messages per chat in Redis (`ai-veronica:conversation:<chatId>`, 24 h TTL): the question and the checked answer as text, never tool payloads.
- **Telemetry.** `app.ai.chat.events{outcome, command, route}` (outcomes `answered`, `redacted`, `fallback`, `failed`; route `investigation`) and a `chat` row in `ai.runs` with the cost.
- **Env.** `GITHUB_READ_TOKEN` (optional, read-only; `recent_changes` reports itself unavailable without it) and `GITHUB_REPOSITORY` (default `eurusik/ratingo`).
- **Eval.** `npm run eval:chat --workspace=@ratingo/ai-veronica` runs `apps/ai/veronica/eval/chat` (15 cases with fixture tool results). On the stub model it replays reference answers and checks the harness; with `AI_MODEL_FAST=anthropic:<model>` and `ANTHROPIC_API_KEY` it measures tool-selection accuracy, fact accuracy and cases where the numbers guard fired (target 0). `EVAL_DUMP=<file>` writes the answers.

### Answer log (`ai.chat_exchanges`)

- One row per finished exchange: `run_id` (→ `ai.runs`), `chat_id`, `created_at`, `route` (`command`, `happy`, `investigation`), `question`, `answer` (the final checked text sent to Telegram), `outcome` (`answered`, `redacted`, `fallback`, `failed`), `cut_numbers` (what the numbers guard removed) and `tool_names`. Tool payloads, raw model output and secrets are never stored; text is clipped to 8000 characters.
- Written after the run row is saved, best-effort: a failed insert is logged with its reason (`Обмін для запуску … не записано: <ErrorName>`) and never touches the reply. An exchange without a run (an empty question) is not logged.
- Retention is 30 days. The daily BullMQ job `exchange-retention` (scheduler id and cron in `chat.constants.ts`, 03:17 Europe/Kyiv, on the `chat` queue) deletes older rows; it is idempotent because it deletes by a cutoff, so running it twice removes nothing more.
- `npm run chat:export --workspace=@ratingo/ai-veronica -- --since=7d [--outcome=redacted,fallback]` reads `DATABASE_URL` and prints the matching exchanges as a JSON array of eval case drafts (`id`, `question`, `expectedTools`, `reference.answer`, empty `fixtures` and `mustContain`, plus an `observed` block). A person writes the fixtures and the `mustContain` groups before moving a draft into `eval/chat/cases.ts`. The script only reads.

### Happy through Veronica (step 3)

What the owner sees:

- **A PR link of the configured repository, or «Хеппі, глянь 470» / «Happy, рев'ю #470».** Plain code, no model. If Happy already has a result for the PR's current head commit, Veronica replies at once with a short summary and the report link. Otherwise she asks Happy to review, replies «Хеппі взявся…», and a delayed `happy-follow-up` job in the `chat` queue polls Happy every 30 seconds (at most 20 times) and posts the summary when it is ready. If the PR gets a new commit first, is not published or the polls run out, she says so and points to the PR.
- **A link to another repository** is rejected politely. A Happy mention without a number asks for one.
- **A free-form question** («що там Хеппі сказав про 470?») goes to the investigation agent, which can call `ask_happy`. That tool only reads; requesting a paid review stays on the deterministic path.

Routing table (first match wins, all plain code):

| Message                                                                                                                                 | Goes to                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/status`, `/queues`, ...                                                                                                               | command, no model                                                                                                                                                                           |
| «Хеппі, глянь 470», a PR link of the configured repository                                                                              | Happy, that PR                                                                                                                                                                              |
| a review verb and a PR word with a number: «а глянь 469 пр», «переглянь PR 470», «рев'ю #470», «check pr 470», «шо там по мру 469»      | Happy, that PR                                                                                                                                                                              |
| a review request without a number: «зроби ревью», «проревʼюй», «глянь шо там по мру», «глянь мр»                                        | Happy, pick the PR: one open PR is taken and named («Беру PR №471 «…»»), several open PRs are listed (five at most, with author and age) and the owner is asked for a number, none: says so |
| «Veronica, …», a free-form question («що Хеппі сказав про 470?», «скільки PR злили за тиждень?», «глянь по коду де може бути проблема») | investigation agent; it can read Happy's result with `ask_happy`, and says plainly it cannot read code yet                                                                                  |

Verbs: глянь, переглянь, подивись, перевір, рев'ю / ревʼю / ревью / ревю, review, check, «шо/що там по», «зроби ревью», «проревʼюй». PR words: PR, пр, мр (мру, мрку), MR, пулл, пулреквест, пул-реквест, pull request, merge request. A verb with only a number («глянь 469») or only a PR word is not enough, and a paid review starts only once the target is unambiguous. A bare number in answer to the list is not recognised; the reply suggests «глянь #471».

Release PRs (`development` into `main`): Happy's result has `kind: release_checklist` (older markers and checks without one are told apart by status or by the PR's branches), and the lookup carries the PR's `baseBranch` and `headBranch`. Veronica explains in plain words that Happy does not review code on releases but builds a checklist without a model, and for «останній злитий MR + ревʼю» she takes the newest merged PR with `isRelease: false` from `recent_changes` (base `main`, head `development` marks a release), mentions the release separately and asks Happy about the PR with code. The result marker of a checklist carries a short digest (counts of migrations, risky migrations, new env vars, changed apps, dependency changes, and whether the lockfile changed), which Veronica shows in one line and `ask_happy` returns. The checklist does not list the PRs it includes, because Happy does not have them; they come from `recent_changes`. A check without a marker is returned with status `unknown` and kind `review`, never as a checklist; Veronica says it is in the old format and, from the branches Happy returns, may add that it is a release PR. A full-mode request (`глянь 474 повністю`) counts a release checklist and a skipped result as done, since they can never have a review scope, on both sides.

The branch names that make a release (`development` into `main`) exist in both services: `RELEASE_*_BRANCH` in Happy's `release.constants.ts` and in Veronica's `happy.constants.ts` (used for `recent_changes`, where GitHub data comes without Happy). They must match; each service has a test that pins the values. When Happy's answer carries the branches, Veronica uses those.

`recent_changes` reads the closed pull requests of `main` and `development` ordered by update time and pages (at most four pages of 30) until it reaches pull requests last updated before the window, so a merged PR is not pushed off the first page by later updates of older ones.

Number extraction from a mention is deliberately strict: at most three words around one number (`глянь 470`, `рев'ю #470`). Longer sentences ask for the number instead of guessing.

A full review is asked with «повністю», «повне рев'ю», «повного рев'ю» or «full» in the message («глянь 470 повністю», «повне рев'ю 470»); the marker is cut out before the number is read, and only a message that carried a marker may use a bare number after the verb. «нові коміти» («глянь нові коміти в 470») is cut out the same way and keeps the automatic mode. A bare «глянь 470» without Happy's name stays with the investigation agent, as before. Without a marker the request is `auto`: incremental when possible. The summary shows «нові коміти: ✅ N виправлено · ⚠️ N лишилось · 🆕 N нових» (plus ❓ when some finding is unconfirmed) after an incremental review and «Повне рев'ю: <причина>» after a full one.

Happy's internal API (`modules/webhook`, reachable only over the Railway private network, `happy.railway.internal`):

| Request                                       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /internal/pull-requests/:number/review` | enqueues the same review job as `/happy review`, keyed by repository, PR and head commit, so a repeat is coalesced. An optional JSON body `{"mode": "auto" \| "full"}` (default `auto`) forces a full review; a full request has its own job id and counts as already reviewed only when the head's result is a full review. Returns `queued`, `already_running`, `already_reviewed` (with `headSha`), `skipped` (with `reason`: `closed`, `merged`, `untrusted_fork`) or `not_found`; a bad `mode` is 400 |
| `GET /internal/pull-requests/:number/review`  | `not_found`, or `found` with `headSha`, `reviewPending` and the latest `result` (status, voice line, summary, counts by severity, questions, coverage, the commit it was for, whether that is the current head, the check-run URL, and `review`: `mode` (`incremental` or `full`), `baseSha`, `fullReason`, the number of files reviewed and `statusCounts` of `new`, `stillOpen`, `resolved`, `needsRecheck`; `null` for a result without tracked state), or `null`                                       |
| `GET /internal/pull-requests`                 | `ok` with the open pull requests of the repository, most recently updated first (number, title, author, `updatedAt`, up to six), read with Happy's own GitHub App. Veronica uses it to resolve a review request without a number                                                                                                                                                                                                                                                                           |

- The repository is the first entry of `HAPPY_ALLOWED_REPOS`; only a PR number comes in. Fork PRs from untrusted authors are refused, as for the webhook.
- Happy stores no state of its own. The `Happy` check run's summary ends with a hidden `<!-- happy:result:v2 … -->` marker (base64url JSON of the result and its tracked findings; v1 markers, URL-encoded JSON without findings, are still read and mean «no tracked state»), written when the check is published and read back through the Checks API. The last marker in the summary wins. If the state does not fit the marker size limit, Happy writes the marker without the tracked findings, and the next review is a full one. Only runs created by Happy's own GitHub App are trusted. A check without a marker (published before step 3) is returned as status `unknown` with its title only. If the PR has no result for its current head, Happy looks at its five latest earlier commits and marks that result as not current.
- Auth: `Authorization: Bearer <HAPPY_SERVICE_TOKEN>`, compared in constant time (hashed first, so length does not leak). With no token configured, every internal route answers 404; a wrong token is 401. A request that carries a public proxy header (`X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP` and similar) is also answered 404, so a rule mistake in front of Happy does not expose the API. The Cloudflare WAF still allows only `/`, `/health` and `POST /webhooks/github` on the public hostname.
- Happy listens on `::` so Railway's IPv6 private network can reach it.
- Veronica calls it with a 10 second timeout and never retries; polling is the retry. Veronica has no GitHub write credentials.

Env:

| Service  | Variable              | Notes                                                                      |
| -------- | --------------------- | -------------------------------------------------------------------------- |
| Happy    | `HAPPY_SERVICE_TOKEN` | secret, at least 24 characters; unset disables the API                     |
| Veronica | `HAPPY_SERVICE_TOKEN` | the same secret                                                            |
| Veronica | `HAPPY_INTERNAL_URL`  | not secret, `http://happy.railway.internal:8080` (Happy's port on Railway) |
| Veronica | `GITHUB_REPOSITORY`   | already used by `recent_changes`; links and numbers are checked against it |

Failure modes:

- Happy down, URL or token missing, wrong token, a non-2xx answer or a wrong response shape: chat answers that Happy is unavailable; `ask_happy` returns a tool error the agent reports honestly. The digest and commands are unaffected, and a missing or odd value never stops Veronica from booting.
- Happy up but GitHub failing: the API answers 502 and Veronica treats it as unavailable.
- A follow-up poll that cannot reach Happy waits for the next attempt and gives up at the limit with a link to the PR.
- A review that fails twice stays failed in the queue; the next request for the same commit replaces it.

### Security

- The secret header is compared in constant time.
- Allowlist: user ID and chat ID, private chat only for now.
- User text and tool output are data, never instructions. They never choose tools or targets.
- Output is sanitized: an allowlist of Telegram HTML tags, no links the bot did not build, the 4096-character limit.
- Buttons carry an opaque single-use ID (TTL 15 minutes) that maps to a pending action stored server-side, never the action itself.
- Per-message and per-day budgets, backed by the Redis spend store.

### Failure modes

- Model down: commands still work, and a free-form question gets honest raw numbers.
- Telegram retries are idempotent by `update_id`.
- Long runs post «шукаю…» first, then edit that same message.

### Cost

Commands cost $0. A free-form question on Haiku costs about $0.005–0.02.

### Steps

1. Webhook and commands (no model).
2. Free-form Q&A with an eval set (done).
3. Happy through Veronica (`ask_happy`, PR-link pattern) (done).
4. Confirm buttons.
5. DUM-E.

---

## Happy: code review

1. **Webhook:** GitHub App events `pull_request` (`opened`, `ready_for_review`, `reopened`) and `issue_comment` whose first non-blank text is `@happy-on-duty scan` or `@happy-on-duty review` (aliases `/happy scan`, `/happy review`; matched case-insensitively, never inside code blocks or quotes) from an owner, member or collaborator. A command forces the review of a trivial PR; `too_large` still skips. The check title and the first line of its summary carry one line of voice from `check-voice.constants.ts`; findings stay factual. A new push (`synchronize`) does not start a review: Happy reviews once, when the PR is ready. The signature is checked against the raw body, and the handler returns 2xx at once after enqueueing a job.
2. **Idempotency:** the job id is repository, PR and head commit (a command is keyed by its comment), so a redelivery is one job. Before publishing, the worker skips a PR that is closed, merged or no longer at the reviewed commit.
3. **Scope:** drafts are skipped. Only PRs from the same repository or from allowlisted authors are reviewed, so a fork PR cannot spend the budget.
4. **Incremental review:** the hidden `<!-- happy:result:v2 … -->` marker in the check summary carries the reviewed commit, the review scope and every tracked finding (fingerprint, file, line, severity, category, message, code excerpt, status). Only markers from Happy's own GitHub App are trusted; there is no database. On a new request the worker finds the latest earlier review among the PR's last 20 commits and picks a scope with the pure policies `review-scope` (before the compare) and `resolveScope` (after it):
   - **incremental** when the previous review was complete (status `reviewed`, no coverage gaps) and the GitHub compare API says the new head is `ahead` of the last reviewed commit. The model reviews only the diff `lastReviewed...head` (limited to files that are still in the PR diff), with the whole PR as read-only context through `list_changed_files` and `read_file`; findings must sit on lines the new commits changed. If the new commits touch only ignored files, no model is called;
   - **full** when there is no previous review (`no_previous`; after a rebase the old commit is no longer in the PR, so this reason also covers it), the marker is untrusted or has no tracked state (`previous_unreadable`), the previous review was incomplete (`previous_incomplete`), the history diverged or went behind (`history_rewritten`), the compare failed (`compare_failed`) or a full review was asked (`requested`). The reason is shown in the summary and stored in the marker.

   Every earlier open finding is classified against the new head without the model where possible (`finding-carry-over`): the excerpt is located in the head file (it may have moved), then ✅ `resolved` when the file was touched and the excerpt is gone (or the file is gone), ⚠️ `still_open` when the excerpt is there and the new commits did not change lines within five lines of it, ❓ `needs_recheck` when they did, when the file could not be read or when the diff is unavailable. A full review sends every earlier finding to the model as ❓. The model returns a verdict for each ❓ finding in the same run (`recheck`); a ❓ finding without a verdict stays ❓, so nothing is dropped silently. New findings are 🆕; a model finding that matches an open earlier one (same fingerprint, or same file, category and excerpt) is not reported twice. Resolved findings are shown once and then leave the tracked state.

5. **Filtering:** lockfiles, generated `packages/api-contract` types, snapshots and migration metadata are skipped.
6. **Rules from the base branch.** `CLAUDE.md`, `.claude/rules/*.md` (matched by their `paths:` frontmatter), prompts and config are always read from the PR's base branch. Anything from the PR head is untrusted data inside clear delimiters, never instructions.
7. **Findings:** structured output (file, line, severity, message, suggestion). Code checks every line against the diff hunks and drops the rest.
8. **Posting:** one review with event `COMMENT` only, never `APPROVE` or `REQUEST_CHANGES`, plus a summary comment updated in place. Model text is stripped of `@mentions`, images and external links before posting.
9. **Shadow mode first:** Happy posts only a check run with a `neutral` conclusion (summary in the output, findings as annotations) while CodeRabbit keeps reviewing. CodeRabbit is turned off once Happy finds as many real issues with less noise.
10. **Precision:** each finding carries evidence that code checks against the head file, otherwise it becomes a question; deterministic precedents; a coverage section that lists unreviewed files; a file-list prompt for large diffs. `apps/ai/happy/eval` measures it.
11. **Release PRs** (`development` into `main`) get a checklist from the diff (migrations, new env names, changed apps, dependencies) with no model call.

Model: `review` alias. A cheap first pass on `fast` can mark risky files so the larger model reads only those. GitHub App permissions: `contents: read`, `pull_requests: read`, `checks: write`, `metadata: read`. Posting comments later needs `pull_requests: write`.

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
- Metrics: `app.ai.runs` (agent, task, trigger, outcome), `app.ai.run.cost` (USD), `app.ai.run.tokens` (kind), `app.ai.run.duration`, `app.ai.tool.calls`, `app.ai.mcp.calls` and `app.ai.mcp.call.duration` (server, tool, outcome), `app.ai.mcp.server.events` (server, event).
- Logs carry run IDs and outcomes, not prompts, PR content or chat text.
- A `Ratingo / AI` Grafana dashboard, plus the missing-digest alert.
- Watchdog heartbeat: gauge `app.ai.watchdog.last_tick_timestamp_seconds` (Prometheus `app_ai_watchdog_last_tick_timestamp_seconds`), the Unix time of the last finished watchdog tick. It is absent until the first tick, so an alert on its absence or age catches Veronica herself being down.

### Watchdog (`modules/watchdog`)

- A BullMQ scheduler `watchdog-tick` (queue `watchdog`, prefix `ai-veronica`) fires every 5 minutes. A scheduler produces one job per interval bucket, so a restart or a second replica never doubles a tick.
- Pure domain rules evaluate five alert keys: `happy_down` (`GET {HAPPY_INTERNAL_URL}/health` failed on 2 consecutive checks; skipped when the URL is unset), `digest_missing` (no `sent` row in `ai.digest_deliveries` for today's Kyiv date at or after 09:30 Europe/Kyiv, by the injected clock), `budget_agent` and `budget_chat` (spend over the rolling day window ≥ 80% of the agent's `perDayUsd` and of the chat's daily cap, read through the same `RunRepository.spentUsd` the budgets use) and `failed_runs` (≥ 3 `failed` runs of this agent in the last hour).
- Alerts fire on change only. The active keys live in Redis (`ai-veronica:watchdog-state:active`, 7 days TTL, refreshed every tick); a key that was not active and fails now sends one alert, a key that was active and is healthy now sends one «✅ відновилось». A check that cannot run (database or Redis error) is logged and leaves that key's state as it was, so an outage of the probe never counts as recovery. If Telegram fails, state is not saved and the next tick retries.
- Redis keys never live under a BullMQ queue namespace `<prefix>:<queue>:` (for example `ai-veronica:watchdog:`): BullMQ owns every key there. Watchdog state uses `ai-veronica:watchdog-state:*`, and a spec checks every key the app builds against all its queues.
- Before 09:30 a missing digest is «not evaluated», so an alert that was raised yesterday stays active across midnight until today's digest is sent.
- Not covered: Happy's own spend. Happy keeps its spend in its own Redis keys and has no Postgres run table, so Veronica cannot read it cheaply.

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
