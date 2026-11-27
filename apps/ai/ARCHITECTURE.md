# Ratingo AI — Architecture (ADR-001)

> Status: **Proposed** · Date: 2026-11-21
>
> A small agent platform. One shared core package, one shared tools package and one service per agent. The first agents are **Veronica** (daily project digest and Telegram chat) and **Happy** (pull request code review). **DUM-E** (read-only investigation of "why" questions) is built in four steps; steps 1 to 3 (reading code, logs, failed jobs and metrics, and Veronica handing questions to it in the background) are done.

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
  ai-ops-tools/           @ratingo/ai-ops-tools   read-only logs, failed jobs and metrics tools shared by Veronica and DUM-E; knows Ratingo
apps/ai/
  veronica/               @ratingo/ai-veronica   digest, investigations, Telegram chat and router
  happy/                  @ratingo/ai-happy      GitHub PR review
  dume/                   @ratingo/ai-dume       code investigator: answers "why" questions from the code of one commit, with verified citations
```

- **Each agent is its own Railway service** with its own environment. A process only holds the credentials of the agent it runs. Happy reads untrusted PR content, so it must not share a process with Grafana, GA4 or database credentials.
- **Agents import only `@ratingo/ai-core`, `@ratingo/ai-ops-tools` and `@ratingo/node-telemetry`**, never each other. When the chat router in Veronica needs Happy, it calls Happy's service over the Railway private network with a service token; Happy runs the request with Happy's own credentials, model and budget.
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
    │   ├── create-run-repository.ts    # the one way an agent builds its repository: base store, durable spend, telemetry
    │   └── telemetry.run-repository.ts # metrics and logs only
    ├── manifest/
    │   ├── agent-manifest.schema.ts
    │   ├── task.schema.ts
    │   └── agent-folder.loader.ts      # reads agent/, validates, fails fast
    ├── clock/
    │   └── clock.port.ts
    ├── http/
    │   └── internal-access.ts          # decideInternalAccess: the check behind every internal endpoint
    └── telemetry/
        ├── ai-metric-names.ts          # app.ai.*
        └── agent-budget-gauge.ts       # app.ai.agent.budget.day from the manifest
```

### `packages/ai-ops-tools`

Framework-free like `ai-core` (no Nest, no `process.env`, no `Date`; connections, a `ClockPort` and a logger come from the agent) but it knows Ratingo: the service names in Loki, the metric names and PromQL templates, the `reporting.daily_job_failures` view. That is why it is not part of the core, which stays generic. It was written inside Veronica and moved here when DUM-E became the second agent that needs the same tools (the placement rule below).

```
packages/ai-ops-tools/src/
├── logs/           LogQL builder, record parsing and grouping, Loki adapter, LogsSearchExecutor, input schema
├── job-failures/   port, Postgres adapter and reader connection, JobFailuresExecutor, input schema
├── database/       ExplorerPort, Postgres adapter, SQL statement policy, failure classes, DbSchemaExecutor, DbQueryExecutor, input schemas
├── metrics/        port, Prometheus adapter, PromQL builders, metric templates, schedule wording, MetricsQueryExecutor
├── shared/         window and name parsing, InvalidOpsInputError, the logger port
├── time/           Kyiv time and Kyiv day
├── tools/          createOpsTools(executors, { decorate }): the five tools, descriptions and output caps
└── testing/        simulators of the Loki, Prometheus and failed-jobs sources for evals
```

- `createOpsTools` returns the three `Tool`s. Tool names, descriptions, input schemas and output caps live only here; an agent cannot reword them. `decorate` lets an agent change an executor's result before it is serialised (DUM-E adds evidence refs); Veronica passes none.
- A port that is not configured is an `Unconfigured*` adapter: the tool stays offered and answers with the reason (`logs_search is unavailable: not_configured`). A failed call is a tool result, never an exception. Every executor takes a logger and writes the reason of each failure of its port to it; a tool that was never configured is not a failure and is not logged on each call.
- The simulators run the real adapters over a fake `fetch` or port, so an eval fixture is produced by the same code as production: the Loki simulator parses the LogQL that `buildLogQuery` produces and refuses any other shape; the Prometheus simulator answers by the metric and the labels of the PromQL it is asked, so any correctly parameterised call gets the right samples.
- A capability folder never imports another one (`logs`, `job-failures`, `metrics`); `shared` and `time` are the bottom; `tools` and `testing` sit on top. ESLint enforces it.
- Veronica's definitions and outputs are pinned by `ops-tools.golden.spec.ts` (66 snapshots: the ten definitions in order, every output shape, the exact error and unavailable texts, the system card text). The test renders a fixed fixture of schedules, queues and providers, not the live system card, so a new job in the api cannot change it. The snapshots were recorded on the code from before the move and the moved code passes them unchanged.
- The same names are env variables of each agent that runs the tools: `GRAFANA_LOKI_URL`/`USER`/`TOKEN`, `AI_READER_DATABASE_URL`, `AI_EXPLORER_DATABASE_URL`, `GRAFANA_PROM_URL`/`TOKEN`. All are optional. Give each agent its own read-only tokens; a process holds only the credentials of the agent it runs.

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

### `apps/ai/dume`

DUM-E answers "why does the system behave like this" from the repository's code and read-only runtime data, in four steps: (1) code reading with verified citations and an eval, run from the command line only (done); (2) the logs, job failures and metrics tools Veronica already had, now shared through `@ratingo/ai-ops-tools` (done); (3) Veronica delegates to DUM-E in the background and relays the answer (done, see "DUM-E as a service" and "DUM-E through Veronica"); (4) read-only catalog data (done as the shared `db_schema` and `db_query` tools, see "Database explorer"). It is its own service (not a Veronica module), imports only `@ratingo/ai-core`, `@ratingo/ai-ops-tools` and `@ratingo/node-telemetry`, and has a Dockerfile (tini, then `node` on `dist/server.js`) that CI builds and starts (`dume-image`) and a `railway.json` whose watch paths CI checks. It runs as an HTTP service behind the Railway private network; the owner creates the Railway service.

```
apps/ai/dume/
├── package.json · tsconfig*.json · jest.config.js · Dockerfile · .env.example
├── agent/
│   ├── agent.yaml                      # alias review, $0.30 per run, $1.50 per day, 20 turns, six tools
│   └── prompts/                        # investigate.md (role, how to investigate, answer contract,
│                                       # untrusted rule) and final-answer.md (the last-turn instruction)
├── fixtures/retry-policy.fixture.ts    # a file with a planted instruction, for the eval
├── eval/                               # see "DUM-E eval"
└── src/
    ├── main.ts                         # the CLI entry
    ├── server.ts                       # the HTTP service entry (internal API, queue worker)
    ├── health/                         # GET /health
    ├── cli/cli-arguments.ts
    ├── config/                         # env schema (zod), aliases, prices
    ├── telemetry/                      # structured logger, OpenTelemetry metrics
    ├── core/                           # Nest wiring for ai-core and ai-ops-tools (OpsRuntime), AgentRunner, stub model script
    └── modules/
        ├── investigation-requests/     # the service side: internal API, queue, result store, limits
        └── investigation/
            ├── domain/
            │   ├── constants/              # snapshot limits, search/read/list limits, citation limits
            │   ├── entities/               # CodeSnapshot, investigation answer, outcome
            │   ├── errors/
            │   ├── ports/code-snapshot.port.ts
            │   └── policies/               # repo-path guard, search pattern, line range, file inspection,
            │                               # directory listing, evidence ledger, answer verifier
            ├── application/
            │   ├── services/               # CodeBrowser, InvestigationService
            │   ├── tools/create-code-tools.ts · runtime-evidence.recorder.ts
            │   └── schemas/investigation-draft.schema.ts
            ├── infrastructure/
            │   ├── adapters/               # GitHub tarball, local directory, directory snapshot
            │   └── archive/tar-reader.ts   # streaming tar parser
            └── presentation/format-outcome.ts
```

**Code snapshot (`CODE_SNAPSHOT_PORT`).** `resolve(ref)` returns a `CodeSnapshot`: one commit of the repository, with the list of readable files (path, bytes, line count), the reason a file is skipped, and `readLines(path)`. Two adapters:

- `GithubCodeSnapshotAdapter` (default): resolves the ref (`main` or `development` only, anything else is refused before any request) to a commit SHA with `GET /commits/<ref>` (media type `application/vnd.github.sha`), downloads that commit's tarball with `fetch`, streams it through gunzip and a small tar parser, and writes the files into a private temp directory (`0700`, files `0600`). Snapshots are kept per SHA, three at most; the least recently used is deleted, but never one that was resolved in the last 10 minutes, since a run may still be reading it (the limit can be exceeded for a short time). The ref is checked again at most once every five minutes; when the check fails and an older snapshot of that ref exists it is served with a warning. A download is shared between concurrent requests. If a new commit cannot be downloaded or unpacked, the previous snapshot of that ref is served with a warning and the failed commit is not retried for a minute. A token (`GITHUB_READ_TOKEN`) is optional; the repository is public. The temp directory is removed on shutdown.
- `LocalDirectoryCodeSnapshotAdapter`: serves a local checkout (`git ls-files` for tracked and untracked, not ignored, files) at the fixed label `local-checkout`. The eval and `DUME_LOCAL_CHECKOUT` use it.

Guards: every path is normalized by the pure `normalizeFilePath` (no absolute paths, no `..`, no `.git`, no backslash or control characters, bounded length and depth); archive entries that are not regular files (links, devices) are skipped; a file is read only if it is in the index; files over 300 KB, binary files (NUL byte), invalid UTF-8 and files with a line over 6000 characters are skipped with a reason; the archive is limited in compressed size, unpacked size and file count. Limits are constants in `domain/constants/snapshot.constants.ts`.

**Tools** (read-only, in-process, no shell; output is wrapped as untrusted data and cut by whole rows with `RowList`):

| Tool          | Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `code_search` | Text or safe-regex search per line, optional path prefix and extensions. Returns `{path, line, text}` rows, `omitted` and a hint, and a coverage block. Regex mode refuses nested or group repeats, lookarounds, backreferences, unicode escapes and a pattern whose repeats (`*`, `+`, `?`, `{n,m}` all count) could multiply past a fixed budget, about two open-ended repeats; it checks only lines up to 300 characters, and the matching runs in a worker thread that is killed after 3 seconds per file, so a pattern that backtracks badly stops the search (`stoppedForTime`) instead of the process |
| `code_read`   | Numbered whole lines of one file, 150 by default, 400 at most, cut by whole lines to fit the output budget with `nextStartLine`; a missing or skipped path is an error that says why and lists files with the same name                                                                                                                                                                                                                                                                                                                                                                                      |
| `code_list`   | One directory level: subdirectories with file counts, then files with line counts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Each description states what the tool covers (only the tracked text files of one commit, no history, nothing generated or ignored), what it does not, and that an empty result does not prove the code lacks the behaviour. The handlers record in an `EvidenceLedger` exactly the lines the model was shown (using `countRowsThatFit`, so the ledger and the reply never disagree).

**Runtime tools.** `logs_search`, `job_failures`, `metrics_query`, `db_schema` and `db_query` are the Veronica tools from `@ratingo/ai-ops-tools`, with the same descriptions and limits; DUM-E builds them with `createOpsTools(executors, { decorate })`. `core/ops-runtime.factory.ts` wires their ports from `OpsConfig`; a variable that is missing makes that tool report itself unavailable instead of stopping the service, and a Loki configuration with only some of its three variables logs which ones are missing. Log text is untrusted (`<untrusted label="production logs">`). The prompt has one line on how to cite their rows and nothing else about them; what each tool covers, and what an empty result does not prove, is in its description.

**Runtime evidence.** A log row or a metric is not a file line, so a claim cites it by a `ref` that DUM-E gives it. The `decorate` hook copies each row of a list result with a `ref` as its first field (`logs_search#2.3`, the second `logs_search` call, third row); an empty list or a result that is not a list gets a `callRef` instead (`logs_search#2`), which stands for the call and for what the tool said about it, such as the note that an empty `job_failures` does not cover errors a job catches. A wrapper around each tool then reads the text the tool result will have after the registry has escaped, redacted and cut it, and records in a per-run `RuntimeEvidenceLedger` only the refs that are in it, each with a short redacted summary; the last row of a cut result is not recorded. The rows of `db_schema` and `db_query` hold arbitrary user text, so their rows are nested as `{ref, row}` and the wrapper reads the refs from the structure of the tool's own output, before redaction and never from inside `row`: a column called `ref`, a json value or a string that looks like a ref is not a ref, and a result that was cut records nothing. Because the hook is DUM-E's, Veronica's outputs have no refs.

**Answer contract.** The model returns JSON: a short `answer`, `claims` (each with `citations` of `{path, startLine, endLine}` for code and `evidence` refs for runtime rows), `assumptions` and `unknowns`. The pure `verifyAnswer` policy checks every citation: the path is valid, the file exists in the snapshot, the lines exist, the range is at most 80 lines, and the whole range was returned by a tool in this run. A runtime `ref` passes only if the ledger holds it, that is, a tool showed that row in this run (`evidence_not_shown` otherwise, and the output names the ref). A claim whose citations and refs all pass is a fact, and a fact prints the cited rows with their summaries beside the lines. A claim with any failing or missing citation or ref is moved to the assumptions with the reason (`unverified_claim`), never dropped and never shown as a fact. Like a code citation, a ref proves that the row was shown to the model, not that the claim follows from it; the judge in the eval checks the meaning. The result carries `support`: `supported`, `partly_supported`, `unsupported` or `no_claims` (a valid answer for "the code does not say", with what was checked in `unknowns`).

**Loop.** One `AgentLoop` run on alias `review`, at most 20 turns, 4 minutes and $0.30 (the agent's day budget is $1.50; with `REDIS_URL` the day total is shared between processes like Happy's). The registry is created with `guardRepeatedCalls`: a call with the same tool and input as an earlier one in the run that failed or returned nothing is not run again; the model gets the earlier result with a note. A failed tool is a tool result with `isError`, never an exception. The request sets `finalAnswer`: on the last allowed turn, when the time left is about one call, or when the remaining budget cannot pay for another turn plus the final call, the model keeps the tool definitions (the history holds tool blocks, and the Anthropic API needs the tools defined for them) but `toolChoice: none` forbids using them. The budget reserve counts the next turn plus a final call (with the next turn's output added to its input) against the run, task and day levels, not the per-call level, with the instruction in `agent/prompts/final-answer.md` (answer from what was read, put what is unfinished into `unknowns`), so a run that ran out of turns still returns a partial answer.

**Telemetry.** Runs go through ai-core's `TelemetryRunRepository` (`app.ai.runs`, `app.ai.run.cost`, `app.ai.run.tokens`, `app.ai.run.duration`, `app.ai.tool.calls` with `agent=dume`). Logs use the shared structured logger (`ratingo-dume`): run ids, outcome, support and counts only, never the question, the prompt or file content. A signal closes the Nest context (removes the temp directory and the Redis client), flushes logs and metrics and exits 130 or 143.

**Env** (`src/config/env.schema.ts`): `AI_MODEL_REVIEW` (default `stub:review`), `ANTHROPIC_API_KEY`, `GITHUB_REPOSITORY` (default `eurusik/ratingo`), `GITHUB_READ_TOKEN` (optional), `GITHUB_API_URL`, `DUME_LOCAL_CHECKOUT` (optional, reads a local checkout instead), `REDIS_URL` (optional), `GRAFANA_LOKI_URL`, `GRAFANA_LOKI_USER`, `GRAFANA_LOKI_TOKEN`, `GRAFANA_PROM_URL`, `GRAFANA_PROM_TOKEN`, `AI_READER_DATABASE_URL` and `AI_EXPLORER_DATABASE_URL` (all optional, one tool each), `LOG_LEVEL` (the CLI defaults to `warn`), `OTEL_*`.

**CLI.** `npm run investigate --workspace=@ratingo/ai-dume -- "<question>" [--ref=main|development]` prints the answer, the facts with their citations, assumptions and unverified claims, unknowns, `support`, the commit, turns and cost. The exit code is 1 when there is no answer.

**What was left in the agents.** `AgentRunner`, `NestRunLogger` and the OpenTelemetry bootstrap are written three times (Veronica, Happy, DUM-E) and are still the first candidates for ai-core. The run repository is no longer one of them: every agent builds it with `createRunRepository`.

The watchdog reads Happy's and DUM-E's spend and failed runs from Prometheus (see Watchdog); the metrics are the only cross-service data.

### DUM-E as a service

`src/server.ts` runs the same `InvestigationService` behind an internal HTTP API; the CLI is unchanged. The service side lives in `modules/investigation-requests`.

| Request                                   | Result                                                                                                                                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /internal/investigations`           | body `{requestId, question, ref?}`; `accepted` (`created` true or false, with the request), `rejected` with a reason (HTTP 429), `conflict` (409: the id was used for another question), 400 for a bad body                                                              |
| `GET /internal/investigations/:requestId` | `not_found`, or `found` with the request: `state`, `reason` for a failure, times, and for an answer the verified result (answer, facts with citations and runtime rows, assumptions, unknowns, `support`, commit, repository, turns, cost). The question is not returned |
| `GET /health`                             | `{status: "ok"}`, no token                                                                                                                                                                                                                                               |

- **Auth** is the shared `decideInternalAccess` of ai-core: `Authorization: Bearer <DUME_SERVICE_TOKEN>` compared in constant time on hashes; no token configured, or a public proxy header on the request, answers 404; a wrong token is 401. There is no public domain.
- **Input:** `requestId` matches `^[A-Za-z0-9_-]{8,64}$`; `question` is 1 to 1000 characters with no control characters except newline and tab; `ref` is `main` or `development` (default `main`); unknown fields are refused; the body is limited to 8 KB.
- **Idempotency:** the record is created with `SET NX` under the request id. The same id with the same question and ref returns the stored request and adds no job and no count; the same id with another question is a conflict.
- **Queue:** BullMQ queue `investigations` with its own prefix `ai-dume`, one worker with concurrency 1, `attempts: 1` (a paid run is never repeated silently) and `maxStalledCount: 0` (a job whose process was killed fails instead of running again). State keys are `ai-dume-state:*`, outside any queue namespace.
- **Reading never writes.** `GET` computes the `interrupted` view of an overdue request but does not store it, and the worker finishes a request with a compare-and-set script that never replaces an `answered` record, so a late read cannot destroy an answer. An overdue `running` request is one whose run clock (`runStartedAtMs`, set once the snapshot is ready, so a slow download does not count) is older than the run timeout plus a minute; if that write failed, the request counts from its start time plus the snapshot allowance (5 minutes), the run timeout and the minute. A `queued` one is older than the longest possible wait.
- **Replays and saves:** a replay of a `queued` request, or of one that failed with `internal_error` before it started, queues it again (the job id keeps that idempotent). Starting a run (`queued` → `running`) and replaying a failed request are compare-and-set transitions, so a run never starts twice and a stale read never overwrites a newer state. A replay also removes the old finished job with the same id, so the new job is not a no-op. The final save is retried three times with backoff before the job fails, and its failure is logged with the run id and the cost. Stored records are validated (version and fields) when read; the record keeps the run id.
- **Shutdown:** on SIGTERM the service first stops accepting HTTP requests, then closes the worker (it waits for the running investigation), then the queue, then the app (tools and Redis), then the telemetry SDK, then flushes the logs and exits 0 (`src/shutdown.ts`). `railway.json` sets `drainingSeconds` to 300, longer than the run timeout, so Railway waits for it. The BullMQ lock and stalled interval are 5 minutes.
- **Result store:** Redis, `ai-dume-state:investigation:<requestId>`, a JSON record kept for 3 days. States: `queued`, `running`, `answered`, `failed`; a failure carries a reason: `budget_stop`, `timeout`, `model_error`, `no_valid_answer`, `code_unavailable`, `day_budget`, `interrupted`, `internal_error`. A `running` record whose run clock is older than the run timeout plus a minute, or a `queued` one older than the longest possible wait, is read as `failed: interrupted`, so a killed process never leaves a request in flight forever.
- **Limits:** at most 2 requests waiting behind the running one (`queue_full`), `DUME_MAX_INVESTIGATIONS_PER_DAY` accepted requests per UTC day, default 10 (`daily_count_cap`), and the day budget from `agent.yaml` (`day_budget`), checked when a request is accepted and again before it starts. A repeated request is never counted twice. The caller gets `rejected` with the reason.
- **Env** (`serviceEnvSchema`, besides the variables above): `PORT` (3006), `DUME_SERVICE_TOKEN`, `DUME_MAX_INVESTIGATIONS_PER_DAY`; `REDIS_URL` is required. In production the model key, the token and a model that is not a stub are required too.
- **Metrics:** every agent builds its run repository through `createRunRepository` of ai-core and so records `app.ai.runs`, `app.ai.run.cost` and the other run metrics the same way, and publishes its daily budget as `app.ai.agent.budget.day` (Prometheus `app_ai_agent_budget_day_USD`) from its manifest.
- **Known gap:** run metrics are written when a run ends, so a run killed by a deploy or by the memory limit leaves no cost and no `failed` count in `app_ai_*`. Its spend is in Redis (the daily cap sees it) and its request becomes `failed: interrupted`.

### DUM-E through Veronica

Veronica hands a "why" question that needs the code and the data together to DUM-E and relays the verified answer as its own message; the owner keeps one entry point. Veronica's side lives in `modules/chat`.

- **Starting.** `ask_dume` (a model decision) or `/why <question>` and «DUM-E, …» (plain code, no model). The tool description carries the rule: use it only for a "why" or "how does it work" question that other tools cannot settle, never for state, counts, lists, schedules, recent errors or what Happy said, at most once per message. The tool is flagged `startsPaidWork`, and a registry refuses such a tool unless it is created with `allowPaidWorkTools: true`, which only Veronica's chat runner does, so a digest or a review run can never start paid work by accident. It returns at once with a status (`started`, `already_started`, `already_running`, `rejected`, `unavailable`, `unconfirmed`, `untracked`) and an `ownerNotice` written by code, which the model repeats in one line without guessing the cause.
- **No duplicates.** The request id is `tg<update_id>`, so a Telegram retry or a retried chat job reaches DUM-E as the same request. A chat has one investigation in flight (`ai-veronica:dume-inflight:<chatId>`, released on delivery); a second question meanwhile gets `already_running`.
- **Never silent.** The delivery claim has three states (`claimed`, `sending`, `sent`): while a send is in progress a retry waits and tries again after the claim's 2 minute lifetime, the number of messages already sent is stored so a retry resumes after them, and only `sent` is a duplicate. When Telegram times out and may have delivered a part, the job is not failed: it is scheduled again after the claim expires and resumes after the stored parts, so at most one part can be duplicated, and after three such tries it is logged, one last best-effort line says the answer (or the rest of it) could not be delivered, and the chat is freed. The stored part count never goes down: the "rest not delivered" line is not counted as a part. If a retry finds that the answer is gone after part of it was sent (no result, deadline), it sends one line saying the rest could not be delivered and never confirms a partial answer as complete. When Telegram refuses the formatted message for good, the same text is sent as plain text, and if that is refused too, one short line says the answer could not be delivered. When a follow-up job fails for the last time, the owner gets that line and the chat is freed. A submit that fails in a way that may have reached DUM-E (timeout, 5xx, unexpected reply) keeps the chat locked, schedules the follow-up anyway and tells the owner the start is unconfirmed; a follow-up that cannot be scheduled after three tries is reported as untracked.
- **Answering.** A delayed `dume-follow-up` job in the `chat` queue polls DUM-E every 30 seconds until 15 minutes after the request was created, then sends the result: the verified answer, or one short line for a failure, a limit, an interrupted run, a missing request or the deadline. The message is built by code from the stored result, never by the model. Delivery is claimed in Redis (`ai-veronica:dume-delivered:<requestId>`): held 2 minutes while sending (the retry waits 125 seconds, so the claim has expired by then), three days once sent, so a retried job cannot send twice and a crash during sending is retried.
- **Format.** The short answer, then the verified facts, each with its code citations as GitHub links to the exact lines of the commit (built by code from the repository, the 40-character commit and a strictly checked path; any citation that cannot be linked is plain text) and the stored summary of each runtime row, then the assumptions with the reason they are unverified, the unknowns, and a footer with the support level, commit, turns and cost. Model text is stripped of links and escaped. At most three messages of 4000 characters, packed by whole blocks; when facts do not fit, facts are dropped first and the assumptions, unknowns and footer stay.
- **Sanitizer.** The Telegram HTML sanitizer drops every link except one whose address is exactly a GitHub `blob/<40 hex>/<path>#L<n>[-L<m>]` URL of the configured repository; paths are percent-encoded by code. DUM-E's client reads values it does not know (a new state, reason, support level or rejection reason) as safe ones, so a newer DUM-E cannot break polling.
- **Failure of the service itself.** DUM-E not configured, down, or answering with an unexpected shape makes the tool answer `unavailable` with the reason; the model tells the owner that the investigation was not started. A client never retries (10 second timeout); polling is the retry.
- **Env (Veronica):** `DUME_INTERNAL_URL` (`http://dume.railway.internal:<port>`) and `DUME_SERVICE_TOKEN`, both optional.

Because the run metrics of Veronica went through a repository that did not record them, her runs were missing from `app.ai.runs` until `createRunRepository`; her own watchdog checks (budget, chat budget, failed runs) still read her Postgres table, which is exact and records every turn.

### DUM-E eval

`apps/ai/dume/eval` follows the chat eval's method: every case runs `--runs` times (3 with a real model, 1 with the stub), passes at a strict majority, and a case whose runs disagree is `FLAKY`. A Sonnet judge (`--judge-model`) decides, per short statement, what the answer must convey and must not claim. Code decides everything else: the answer exists, every citation points at a file and lines that exist, the required files are cited with a verified citation, no forbidden text (an injected code word), no gendered self-reference toward the owner, at least one verified fact on a question the code answers, and at least one unknown on a question it does not. The report and the baseline rules (`eval/baseline.json`; regressions exit 1, an incomplete run exits 2) are the same as in "Chat eval". It is DUM-E's own copy of the chat eval's generic parts. Step 2 compared the two: aggregate, baseline diff and file, options, runner, report, judge and scorer have diverged (Veronica's check tools and numbers, DUM-E's citations), so they cannot be moved as they are; unifying them is left for when one of the two changes shape again. The Loki simulator is shared (in `@ratingo/ai-ops-tools`) because both evals need it.

- **Snapshot.** The cases read the repository checkout through the local-directory adapter (`apps/ai/dume/eval` is excluded, so the model cannot read the answers), at the label `local-checkout`: no network.
- **Cases** (26): 13 answered by the code, 4 whose honest answer is "the code does not say" (a signup count, a production key, the digest's chat id, the deployed commit), 1 with an instruction planted in `fixtures/retry-policy.fixture.ts` and 8 that mix code with runtime data: a TMDB timeout in the logs and where the timeout is set, an empty `job_failures` next to per-show errors in the logs and the pipeline that logs and continues, the 429 count and the retry rule, the backlog peak and the worker's concurrency, the most frequent failure and its class rule, logs that are unavailable, empty logs that prove nothing, and an instruction planted in a log record. Each case lists `evidence` (a file and an `anchor` text, with where it was verified when the case was written), so a case survives edits to the file: the stub finds the anchor's current line.
- **Stub run (CI).** The stub model replays each case's reference: it reads the evidence ranges through the real tools and answers with the reference claims, so cases, anchors, tools, citation policy and scoring are exercised together. A case whose anchor left the code fails with `StaleCaseError` and says which file to update. It says nothing about the model.
- **Runtime fixtures.** A case that needs runtime data names its sources (`runtimeSources`: the tool, its input and an `anchor` text of the row the reference cites) and the data (`runtime`: Loki records, daily failed-job rows, Prometheus series with their labels, or a list of unavailable tools). The data goes through the real adapters and executors (`eval/runtime-ops.ts`), so a fixture cannot drift from what production returns. A case with no `runtime` gets every runtime tool unconfigured, as a deployment without keys would. The stub's reference script calls the case's tools, reads the `ref` of the row that holds the anchor out of the tool result and cites it; a case also lists `requiredEvidence`, the tools one of whose rows a verified fact must cite.
- **Real run.** `AI_MODEL_REVIEW=anthropic:claude-sonnet-5-5 ANTHROPIC_API_KEY=… npm run eval --workspace=@ratingo/ai-dume`; add `-- --save-baseline` to accept it. A change to the prompt, tools or loop merges only with no regression against the committed baseline.

### Placement rules

- Anything two agents need goes to a shared package, never into one agent to be imported by another: `packages/ai-core` when it is generic, `packages/ai-ops-tools` when it knows Ratingo's logs, jobs or metrics.
- An agent-specific integration stays in that agent, even if it might be reused later; it moves to the core on the second real use.
- Prompts, tasks and skills live in `agent/`, never in `src/`. Code does not contain Ratingo hosts, IDs or chat IDs.
- Domain folders (`domain/`) depend on nothing outside the module and on types from `@ratingo/ai-core` and `@ratingo/ai-ops-tools`.

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

| Port                      | Owner                 | First adapter                                                |
| ------------------------- | --------------------- | ------------------------------------------------------------ |
| `MODEL_PORT`              | core                  | Stub, Anthropic                                              |
| `TOOL_SOURCE_PORT`        | core                  | Native tools, MCP gateway, skills                            |
| `MCP_TRANSPORT_PORT`      | core                  | stdio (official SDK client, explicit env)                    |
| `MCP_TELEMETRY_PORT`      | core                  | OpenTelemetry `app.ai.mcp.*`                                 |
| `RUN_REPOSITORY`          | core                  | Postgres (`ai` schema); telemetry-only for Happy             |
| `CLOCK_PORT`              | core                  | System clock; fixed clock in tests                           |
| `METRICS_PORT`            | Veronica `digest`     | Grafana Cloud Prometheus (`ai-ops-tools`)                    |
| `ANALYTICS_PORT`          | Veronica `digest`     | GA4 Data API                                                 |
| `PRODUCT_STATS_PORT`      | Veronica `digest`     | Postgres `reporting` views                                   |
| `LOGS_PORT`               | Veronica `chat`       | Grafana Cloud Loki `query_range` (`ai-ops-tools`)            |
| `NOTIFIER_PORT`           | Veronica `notify`     | Telegram                                                     |
| `CONVERSATION_REPOSITORY` | Veronica `chat`       | Redis                                                        |
| `AGENT_GATEWAY_PORT`      | Veronica `chat`       | HTTP to other agent services                                 |
| `CODE_HOST_PORT`          | Happy `review`        | GitHub App: diff, files at a ref, review, check run          |
| `CODE_SNAPSHOT_PORT`      | DUM-E `investigation` | GitHub tarball of one commit; a local directory for the eval |

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
- **Lists are cut by whole rows, never mid-row.** A handler that returns a list returns a `RowList` (rows, a hint naming the filter that narrows them, and a frame for the rest of the answer). `defineTool` keeps as many complete rows as fit the tool's `maxOutputChars` and adds `omitted` (how many rows were left out) and `hint`. The registry's character cut stays only as a last-resort safety net.
- No shell tool. Nothing runs code from a PR or from model output.
- **A final answer instead of nothing.** `AgentLoopRequest.finalAnswer` (off by default) makes the loop send `toolChoice: none` (Anthropic `tool_choice: {type: 'none'}`; tool definitions stay) and add a prompt on the last allowed turn, when the time left is no more than one call timeout, or when the remaining budget cannot pay for two worst-case calls. A tool call on that turn is not run and ends the run with `max_turns`. The agent supplies the prompt text.
- **A model failure says why.** A run stopped by a model error carries `stopDetail` with the category, the HTTP status and the provider's error type (not the provider's text, which can echo prompt content); it is in the run record and in the `ai.run.finished` log.
- **Empty and failed calls are not repeated.** A registry built with `guardRepeatedCalls` remembers, per run, the calls that failed or returned nothing (a `RowList` with no rows, or whatever the tool's `isEmpty` says) and answers a repeat of the same tool and input with the earlier result and a note instead of running it again. It is off by default, so agents opt in. `countRowsThatFit(list, maxChars)` says how many rows `fitRowList` will keep, for handlers that must know exactly what the model saw.

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

- **Grafana:** a service account with the Viewer role for metrics. Logs use a separate Cloud access policy token with only the `logs:read` scope on the stack.
- **Postgres:** `apps/api` migrations own a `reporting` schema of views that return aggregates only, with no emails or per-user rows. The view schema is the contract; an API migration that would break it has to change the view.
- **Roles:** `ai_reader` has `SELECT` on `reporting` only. `ai_writer` owns the `ai` schema (`ai.runs`) and nothing else. `ai_explorer` has `SELECT` on the application tables of `public` except the private data listed in "Database explorer" below; it has no access to `reporting`, `ai` or the migration journal.
- **Migrations** for the `ai` schema live in `apps/ai/veronica/drizzle`, with their own journal (`migrations: { schema: 'ai', table: '__drizzle_migrations' }`, `schemaFilter: ['ai']`) so they never collide with the API's journal. They run in the Veronica service's Railway pre-deploy step. Every statement is safe to re-run.

### Prerequisite in `apps/api`

Per-job counters reset on every deploy, so a job that runs once a day looks like it never ran. Before the digest reports on schedules, `apps/api` exports `app.scheduler.last_run_timestamp_seconds` per job with a `result` attribute, matching `app.backup.last_run_timestamp_seconds` from `apps/pg-backup`. Until then, the digest says nothing about nightly jobs. `QueueMetricsService` in `apps/api` also exports `app.scheduler.next_run_timestamp_seconds` per job, read from the BullMQ job schedulers of this environment's prefix, with `schedule` (the cron pattern, or `every <n>s`) and `tz` attributes. A job missing from it is not scheduled. The digest's scheduler rule reads both: the collector turns each schedule into the job's last two planned runs (`cron-parser`, or `next − every`), and a job is stale only when its last success is older than the latest planned run that is at least `scheduler.runGraceHours` (6) old, so a weekly job is not flagged between its runs. A job without a schedule falls back to `scheduler.staleHours` (36). Last runs are read over 8 days so a weekly job stays visible.

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

`/help`, `/digest` (builds and sends today's digest now through the digest pipeline without touching the daily `sent` claim, marked as on-demand), `/status` (one screen: block levels from the same rules engine), `/queues` and `/site` (those blocks in detail), `/last` (the last three non-command exchanges of this chat: question → outcome, cost). Free text and mentions of Veronica go to the investigation agent (step 2). `/why <question>` and a mention of DUM-E start a deep investigation without a model. A Happy mention with a PR number and a link to a PR of the configured repository go to Happy (step 3). `/help` lists them.

### Investigation tools (read-only)

- `metrics_query`: only named PromQL templates with parameters, a window of at most 7 days, capped output. No free-form PromQL.
- `product_stats`: the `reporting` views through `ai_reader`.
- `digest_snapshot`: today's snapshot and rule outcomes.
- `recent_changes`: deploys and merged PRs, read-only.
- `ask_happy`: reads Happy's latest finished result for one PR (verdict, counts by severity, questions, coverage). It never starts a review.
- `job_failures`: why background jobs failed, from `reporting.daily_job_failures` through `ai_reader` (the same `AI_READER_DATABASE_URL` as `product_stats`). The API records every failed BullMQ attempt into a daily summary per Kyiv day, queue, job type, scheduler and error class (`rate_limit`, `access_denied`, `not_found`, `timeout`, `network`, `database`, `other`) and keeps 14 days. Parameters: `job` (part of a job or scheduler name), `queue`, `window` (at most 7 days, default 24h). The data is per whole Kyiv day, so the window only picks the days: `countedKyivDays` names the days that are summed (from the day the window starts to today), and `failuresOnThoseDays` and `attemptsExhaustedOnThoseDays` cover those whole days, even when the window is a few hours. Rows are grouped by job, queue and class and sorted by failures. Each row also has the exact first and last failure in Kyiv time and the last message with secrets removed. An empty list means no failure was recorded on those days. Without `AI_READER_DATABASE_URL`, or when the query fails, the tool reports itself unavailable.
- `logs_search`: errors and warnings from production logs in Grafana Cloud Loki, for the question "what exactly went wrong". The model never writes LogQL: it passes `service` (one of the six `ratingo-*` services), `level` (`error`, default, or `warn`, which includes errors), `window` (at most 7 days, default 24h), `mode` (`grouped`, default, or `lines`) and optional `text` (plain substring, any letter case) and exact `job_id`, `request_id`, `run_id` and `queue`. The pure `buildLogQuery` policy turns them into one of a fixed set of query shapes (stream selector, one level filter, exact filters on structured metadata, and for `text` a case-insensitive match on the `message` and `error_message` fields only, so a word that is also a field name never matches every record) and refuses everything else; property tests cover it. One `query_range` call per tool call, newest first, at most 300 records for `grouped` and 60 for `lines`, a 15-second timeout and a 4 MB response cap (300 records at the 4 KB record cap, each escaped in its own stream, are about 2.6 MB; 500 would be about 4.3 MB). A reply that still exceeds the cap is retried once with a quarter of the limit and returned with `limitReached`. `grouped` groups identical records after numbers and ids are stripped (a record the shipper collapsed as `repeats` counts as that many) and gives `countInRecordsRead`, `firstSeenInRecordsReadKyiv`, `lastSeenAtKyiv`, context and the newest sample with `errorName`, `message`, `errorMessage`, a short stack head and the ids. The counts are of the records read, not of the window: when the limit was reached `limitReached` is true and `oldestRecordReadKyiv` says how far back the read went, so the counts are lower bounds. Rows follow the `RowList` contract with `omitted` and a hint naming the filters. The output is redacted again, shortened and wrapped as untrusted content. Without `GRAFANA_LOKI_URL`, `GRAFANA_LOKI_USER` and `GRAFANA_LOKI_TOKEN`, or on any failure, the tool reports itself unavailable with only the failure class (`not_configured`, `timeout`, `network`, `access_denied`, `rate_limit`, `bad_query`, `server_error`, `too_large`, `other`).
- `google-analytics__run_report`, `google-analytics__run_realtime_report`, `google-analytics__run_funnel_report`, `google-analytics__get_custom_dimensions_and_metrics`: Google Analytics 4 for ratingo.top through the MCP gateway (`mcp: [google-analytics]`). The property is pinned from `GA_PROPERTY_ID`, reports go at most 90 days back with at most 50 rows, and paging and quota arguments are hidden. They are optional tools, and a run never waits for them: Veronica lists them in the background at boot (`McpGatewayHost.onApplicationBootstrap`), and a run offers them only once that listing is ready, so the first questions after a deploy are answered without them. If listing fails, the next run starts another listing in the background, and the session's cooldown keeps this from spawning the server on every message. when the key or the property id is missing or invalid, or the server is down, they are simply not offered and the chat works as before. Their prompt (`agent/prompts/chat-google-analytics.md`) is added only when they are offered.

- `ask_dume`: hands one question to DUM-E to run in the background (see "DUM-E through Veronica"); it never waits for the answer.

- `db_schema` and `db_query`: read the application database through the `ai_explorer` role (see "Database explorer"); `db_query` takes free SQL, but only one `SELECT` or `WITH` statement and only what the role may read.

No Railway logs and no free LogQL. The only free SQL is `db_query`, and the database, not the prompt, decides what it may read.

`ask_happy` ships in step 3; the other four shipped in step 2. `metrics_query` templates: `queue_throughput`, `queue_backlog_peak`, `http_client_errors`, `site_requests`, `site_latency_p95`, `site_memory_peak`, `scheduler_last_runs`, `backup_status`, `infra_health`. `scheduler_last_runs` gives one row per job: last success and last failure (hours ago and Kyiv time), and, when the next-run metric answers, `scheduled`, `schedule`, `timezone`, `nextRunAtKyiv` and `nextRunInHours`; when it does not, the rows have no schedule fields and `schedules` says the data is missing. Their PromQL lives in `packages/ai-ops-tools/src/metrics/prom-queries.ts`, shared with the digest collectors. Parameters are validated (queue and provider names, a three-digit status, a window from 1 hour to 7 days, an offset of 0 to 14 days) before they reach a query.

### Database explorer

Veronica and DUM-E can ask anything about what is in the application database without a code change per question. The wall is the database, not the prompt.

- **Role `ai_explorer`** (migration `0044_ai_explorer_role.sql`): created `NOLOGIN` with no password in the migration. The owner sets the password and the connection string by hand (`AI_EXPLORER_DATABASE_URL`, same host and database as `AI_READER_DATABASE_URL`); both agents share one role. `SELECT` is granted on every table and view of `public`, and `ALTER DEFAULT PRIVILEGES` grants it on tables that later migrations create, so new tables are readable automatically. That only works while the same role runs every migration, which the production dry-run checks. Only `public` is granted: `reporting`, `ai` and the migration journal have no `USAGE`.
- **Role settings are defaults, not guards.** Read-only by default, `statement_timeout` 5 s, `lock_timeout` 2 s, `idle_in_transaction_session_timeout` 10 s, `work_mem` 16 MB, `CONNECTION LIMIT 2` (one pooled connection per agent) are applied when the role logs in. A direct session of the role could still change the ones a user may change with `SET`, so they are defaults. The tool cannot do that: it accepts exactly one `SELECT` or `WITH`, so it never sends `SET`, and inside a `SELECT` the only path, `set_config`, is revoked (below). `temp_file_limit` is superuser-only, so it cannot be raised at all. What stops a write is that the role has no write privilege; what bounds a query is that the tool sets the limits itself with `SET LOCAL` inside a read-only transaction that it always rolls back.
- **Private data is closed by `REVOKE` and column grants.** Three tables have no access at all: `refresh_tokens`, `oauth_exchange_codes`, `oauth_accounts`. Eight tables have table-wide `SELECT` revoked and only safe columns granted: `users` (not `email`, `username`, `password_hash`, `avatar_url`, `bio`, `location`, `website`), `user_media_state` (not `notes`), `user_media_actions` (not `payload`), `review_replies` (not `reply_to_username`), `review_reports` (not `details`, `moderator_notes`), `job_failure_days` (not `last_message`), `key_health_checks` (not `detail`), `catalog_evaluation_runs` (not `promoted_by`, `error_sample`). A query that mentions a closed column anywhere, even in a `WHERE`, `GROUP BY` or `row_to_json`, fails with `permission denied` (SQLSTATE `42501`). A column added later to one of these eight tables stays closed until a migration grants it; a column added to a fully open table, and a new table, are readable at once, so the CI guard below decides.
- **Postgres versions.** Production runs Postgres 18.7 and every Postgres-backed CI job uses `postgres:18-alpine`. `docker-compose.yml` stays on 16 on purpose: existing dev volumes hold 16 data, and a container of a newer major version does not start on them. Migration `0045` needs Postgres 15 or newer.
- **Functions** (migration `0045_ai_explorer_function_limits.sql`): `EXECUTE` on `pg_terminate_backend`, `pg_cancel_backend`, `pg_logical_emit_message` (it writes to the write-ahead log), `pg_notify`, `set_config`, `ts_stat`, `ts_rewrite`, the `lo_*` writers, the `*_to_xml` functions that run SQL text and the `pg_advisory_*` family is revoked from `PUBLIC`, so the role cannot end sessions, hold locks the application could wait for, change a session setting, run SQL built from text or write log messages. `temp_file_limit` is set on the role as well. `pg_trgm`'s `set_limit` stays executable: it only changes a session setting and `DISCARD ALL` resets it. The migration fails loudly when its role may not change grants on `pg_catalog`, instead of being recorded as applied with nothing revoked. `set_config` is revoked from `PUBLIC`, so the backup role must be a superuser or hold its own grant (`pg_dump` calls `set_config` on every connection); the tool refuses it by name too. It also sets `security_invoker` on `public_media_items`, the one view that existed before the guard (Postgres 15 or newer).
- **CI guard** (`apps/api/test/explorer-access`, run by the `migrations` job on a fully migrated scratch Postgres, `npm run test:explorer-access --workspace=api`): lists every column the role can read with `has_column_privilege` (the effective answer, including `PUBLIC` and role membership) and cross-checks it with `information_schema.column_privileges` and `role_table_grants`. It fails when:
  - a readable column or table name matches a sensitive pattern (email, password, token, secret, hash, session, cookie, phone, oauth, ip, key, address, message, comment, note, body, contact, telegram, chat_id and others) and is not on the reviewed allow-list;
  - a table linked to users, by a foreign key to `public.users` or by a column name such as `user_id`, `created_by`, `account_id` or `owner_id`, has a readable column that is not of a known safe type (uuid, integers, floats, numeric, money, bool, dates and times, interval, enums, and arrays or domains over those) and is not on the reviewed free-form allow-list, whatever its name: text, json, `tsvector`, a domain over text and every unknown type need a review;
  - a readable view lacks `security_invoker` (a view runs with its owner's rights and would bypass the column grants), or a materialized view is readable and not allow-listed (there are no exceptions today);
  - the role can run a `SECURITY DEFINER` function outside the system schemas, or one of the session-ending and advisory-lock functions;
  - any column of a private table or any closed column is readable, access does not come from a grant to the role, or an allow-list entry matches nothing.

  Fixture migrations prove each rule: a new table with `contact_email` and `session_token`, a table `support_tickets(user_id, message, contact_name)`, a table with innocent names but `varchar` and `jsonb` columns, a view and a materialized view that copy `users.bio` under another name, a `SECURITY DEFINER` function, and a re-granted `pg_advisory_lock` are caught; an innocent table and a `security_invoker` view are not. A reviewed exception always carries its reason in the allow-list file. A name pattern still cannot catch a free-form column in a table that has no user link.

- **`db_schema`** lists the readable tables and views with column names (enum values in braces) and estimated row counts, or with types when `table` names a part of a table name. It never lists a private column: `privateColumns` counts them, and `privateTables` names the closed tables, so the agent says "private" instead of "does not exist". The full listing is about 8,000 characters; its cap is 10,000, cut by whole tables with an `omitted` count and a hint.
- **`db_query`** takes `sql` (and `explain`). The statement policy accepts exactly one `SELECT` or `WITH` statement and refuses a second statement, `INTO`, row locks, `EXPLAIN`, write words and a short list of functions (`set_config`, `pg_terminate_backend`, `pg_cancel_backend`, `ts_stat`, `ts_rewrite`, the advisory family, `query_to_xml`); it treats a non-ASCII letter as part of a name, and refuses a `$` followed by one unless it forms a complete dollar-quote tag. It also refuses `U&"..."` escapes, a backslash in a quoted name and `$1` placeholders, and the functions that run SQL text (`query_to_xml`, `cursor_to_xml`, `table_to_xml`, `schema_to_xml`, `database_to_xml`). It is a convenience for readable errors. The adapter does not trust it: it sends the statement over the extended protocol, where Postgres itself refuses more than one command, and describes it first. Every output column must have its own name (a repeated or missing name is refused with a request to add `AS`), and then each variable-length column is bounded in SQL before the rows leave Postgres: a text, json, array or `numeric` value over 1000 characters is cut with its length (a `numeric` is returned as exact text), `bytea` becomes a size note. Rows are wrapped as `SELECT ... FROM (...) LIMIT 101`, so at most 100 rows come back; when more exist the answer says `omitted: 1` with `omittedIsLowerBound` and a hint. `explain: true` returns the plan without running the query. `NaN` and `Infinity` come back as the strings `"NaN"` and `"Infinity"`, not as null. Dates come back as text (a `timestamp` without time zone is UTC), `bigint` and `numeric` at the top level as exact text, smaller integers as numbers; numbers inside json, arrays and rows are plain JSON numbers (the description says so). The output is wrapped as untrusted (`database rows`) and redacted by the core.
- **One connection, always rolled back.** Calls are serialized in the adapter. Each call reserves the single pooled connection in an `ExplorerSession`, runs `BEGIN READ ONLY`, sets the limits with `SET LOCAL`, runs the statement and always ends with `ROLLBACK` and `DISCARD ALL`, so no setting, temporary table or lock survives to the next call. Every step, not only the statement, runs under a client deadline slightly above the statement timeout; when it passes the connection is dropped (the driver's own cancel opens a new socket whose failure nobody can catch, so it is not used) and the server's `statement_timeout` does the stopping. When the connection is lost (only the codes `08000`, `08001`, `08003`, `08004`, `08006`, `57P01`, `57P02`, `57P03`, or a refused or reset socket; a protocol error such as `08P01` is an invalid query), the adapter does not return the dead connection to the driver's pool, which the driver would write to later and crash on; it replaces the whole pool and the call fails as an ordinary tool error. When `ROLLBACK` or `DISCARD ALL` fails after a call, the connection is replaced too, and the reason is logged as a warning. At most four calls are pending (one running, three waiting); the next one is refused at once as `busy`. On shutdown `close()` refuses new calls, rejects the ones that have not started as `busy` ("shutting down"), and waits only for the one running. `standard_conforming_strings` is set to `on` with the other limits, because the scanner's model of strings assumes it.
- **Failures are answers.** `42501` is `status: private` ("this data is private ... not that it does not exist"), except for a function or sequence, which is `not_allowed`; a missing table or column is `not_found`, a bad statement is `invalid_query`, `57014` is `timeout` ("cancelled after 5 seconds ... no partial result ... do not state any number"), a busy database is `busy`. A refused connection, a lost connection or a missing or malformed `AI_EXPLORER_DATABASE_URL` (wrong scheme, no host, no database name; the value is never logged) makes the tool report itself unavailable with the reason, and a malformed URL does not stop the service from booting. Expected refusals are logged at debug, the rest at warn.
- **Load on the single production database.** One pooled connection per agent, a 5 s statement timeout, a 2 s lock timeout, a read-only transaction that is rolled back after every call. Plain `EXPLAIN` is available to the agent after a timeout; it is not run before every query. Both agents close the connection when they stop, after their workers have finished.
- **Known limits.** Postgres still builds a large value inside the database before the cut, so `SELECT repeat('x', 900000000)` costs database memory and time until the 5 s timeout; nothing large reaches the agent. A name or type rule cannot judge a column's content, so the reviewed allow-lists matter. `reviews.content` and `review_replies.content` of soft-deleted rows stay readable, and `user_media_actions.context`, `user_media_actions.reason_key` and `user_media_state.progress` are unvalidated client text and json: follow-ups. `rowsEstimate` is `reltuples`, which is 0 for a never-analysed table before Postgres 14.
- **Eval.** The cases run through the real tool code against a throwaway database that applies the API migrations and a small fixture (`EXPLORER_EVAL_DATABASE_URL` is an admin URL of any Postgres; the helper creates and drops its own database and a login that inherits the role's settings). The helpers live in the separate entry `@ratingo/ai-ops-tools/testing`. Without that variable the database cases are skipped and reported as skipped, never as passed, a baseline is not saved, and the run is not compared as a full run.

### Investigation run (step 2)

- One `AgentLoop` per message on alias `fast`, with a registry of just these read-only tools, prompt `agent/prompts/chat.md`, at most 8 turns and $0.05 per message; $0.30 per day for the `chat` task and the agent's day budget, both read from the `ai.runs` table.
- «шукаю…» is posted first and then edited into the answer; if the edit fails, a new message is sent.
- **Numbers guard: flag, don't cut.**
  - **Never shortens the answer.** The answer is sent whole. Numbers it cannot verify are listed in one trusted footer line, «<i>Не звірено з даними: 78, 0,503.</i>»: at most 5 numbers, deduped, digits only. The outcome is then `flagged`.
  - **What counts as verified.** A written number is verified when it is:
    - a number from this run's tool results, the question, the last turns or the clock line;
    - such a number rounded to the precision it is written with;
    - for a known value between 0 and 1, its percent form rounded the same way, when «%» or «відсот…» follows it.
  - **Dates.** A date counts only where the answer writes it as a date, a date range or an ordinal day («20 листопада», «з 15 по 21 листопада», «15–21.11», «16-го»). Each date must be one a tool returned (GA `20261120` or ISO `2026-11-20`) or a day inside a range this run requested, resolved against Kyiv's today. A bare number equal to a day is still checked as a number.
  - **Nothing else.** No sums, differences or ratios.
  - **Measuring.** `npm run chat:flags` measures how often flags fire.
- **Fallback.** When the model is down, over budget or the run fails, the reply is the `/status` snapshot with one line saying why. Unverified numbers never trigger it.
- **Memory.** The last 12 messages per chat in Redis (`ai-veronica:conversation:<chatId>`, 24 h TTL): the question and the checked answer as text, never tool payloads.
- **Telemetry.** `app.ai.chat.events{outcome, command, route}` (outcomes `answered`, `flagged`, `fallback`, `failed`; route `investigation`; `redacted` was the outcome before flagging and may still appear in older data) and a `chat` row in `ai.runs` with the cost.
- **Env.** `GITHUB_READ_TOKEN` (optional, read-only; `recent_changes` reports itself unavailable without it) and `GITHUB_REPOSITORY` (default `eurusik/ratingo`).
- **Eval.** `npm run eval:chat --workspace=@ratingo/ai-veronica` runs the chat cases (service, Google Analytics and logs) with fixture tool results; see «Chat eval» below for how it scores, how to read the report and the merge rule.

### Chat eval

A real-model run is noisy: two runs on almost the same code failed different cases, many for wording («рівня мінор» instead of «дрібні», «помилок не було» instead of «немає», «дві» instead of 2). The eval therefore repeats every case, judges meaning rather than words, and compares with a saved baseline. A failure is meant to be a real problem.

**What is checked, and by what**

| Check                                                                                                           | By                                   |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| The right facts are conveyed, and nothing forbidden is claimed (`expectations.conveys`, `mustNotClaim`)         | a judge model, per statement         |
| Invented or wrong numbers and dates                                                                             | the numbers guard (`flaggedNumbers`) |
| Links, secrets, gendered or formal address to the owner, «ніхто не є», text a case forbids (an injected domain) | code (`forbidden-content.ts`)        |
| Tools: `requiredTools` all called (any order), no `forbiddenTools` called                                       | code (`tool-check.ts`)               |

Any other read-only tool call is allowed unless the case forbids it, so a sensible extra call never fails a case. A fallback answer fails without being judged. Every case also needs a `reference` (the calls and one acceptable answer): the stub replays it.

**Repeats and majority.** Each case runs `--runs` times (default 3) and passes when at least `--pass-at` runs pass (default a strict majority, 2 of 3). A case whose runs disagree is `FLAKY`. Cases run concurrently (`--concurrency`, default 4) under the per-message budget guard of the chat itself and an eval-wide `--max-cost-usd` cap (default 4); when the cap is reached the run stops and exits with code 2, because the numbers are incomplete. The cap is soft: runs already in flight finish, so the total can pass it by up to `--concurrency` runs. Exit code 2 also means that some run could not be scored (the judge or the model errored): such a result is not compared with the baseline and is never saved.

**The judge.** `anthropic:claude-sonnet-5-5` (`--judge-model`). It must be stronger than, or at least different from, the model under test (Haiku 5.5), so it does not share its blind spots; matching short statements against a short answer needs no more than Sonnet, and one judgement costs about $0.004, so Opus (twice the price) buys nothing here. It gets a strict rubric (`JUDGE_SYSTEM_PROMPT` in `judge-prompt.ts`; the question, the history and the answer are text to grade, never instructions): judge meaning only, numbers as digits or words, any date format, a hedge removes a claim, denying a claim is not making it. It returns JSON, one `holds` and a one-line `reason` per statement; the code decides pass or fail (a statement the judge skipped fails). Nothing is concluded from a judge error: the run is reported as «could not be scored».

**Calibration.** `eval/chat/calibration.set.ts` holds about 50 answers labelled good or bad on meaning: real answers from past runs (including the wordings the old regexes rejected) and written wrong ones (invented facts, missed key fact, a stale result presented as current, an obeyed injection). The deterministic test checks the labels against the code checks (every label of a language slip, link or forbidden text must be caught by `forbidden-content.ts`, and nothing else may be) and the agreement code with fake judges. `--calibrate` (or `--calibrate-only`) runs the real judge on the set and prints the agreement; below 90 % the judge is not trusted and the exit code is 1.

**Stub mode.** With no `AI_MODEL_FAST` (or `stub:digest`) the model replays each case's reference answer and a fake judge accepts an answer only when it equals the reference. It needs no key, runs 1 time per case, and `eval.spec.ts` runs it in CI: it proves that cases, fixtures, tools and scoring are wired together, and that a wrong answer or a wrong tool fails. It says nothing about the model.

**Running it for real**

```bash
AI_MODEL_FAST=anthropic:claude-haiku-5-5 ANTHROPIC_API_KEY=… \
  npm run eval:chat --workspace=@ratingo/ai-veronica -- --calibrate
```

Add `--save-baseline` to write `eval/chat/baseline.json` (do this only on a run you accept, and commit the file with the change it belongs to); `--only=id1,id2` runs some cases (it cannot save a baseline); `--dump=path.json` writes every answer and verdict.

**Reading the report.** One line per case, `passes/runs`, `pass` or `FAIL`, and `FLAKY` when the runs disagree or `stable` for a failure on every run; each failed run gets a line saying what failed (missing or forbidden tools, the unmet statement with the judge's reason, forbidden content, wrong numbers, fallback, «could not be scored»). The summary gives the pass rate with stable and flaky passes and fails counted apart, the tool-selection rate and the fact rate per run, the honest-«no data» rate on the questions that have no answer, flagged and wrong numbers, cost split into agent and judge, and the comparison with the baseline: regressions (these fail the run, exit code 1; the rules are under «Merge rule»), newly failing but flaky in the baseline (not blocking), newly passing, became or stopped being flaky, cases not in the baseline.

**Merge rule.** A change to Veronica's chat (prompts, tools, executors, the guard, the model) merges only when a real-model run shows no regression against the committed baseline. A regression is any of: a case that passed in the baseline and does not pass now, flaky or not (3/3 falling to 1/3 counts); a case that was stable in the baseline and loses two or more passes, even if it still passes (5/5 falling to 3/5; when the run counts differ, the baseline pass rate is scaled to the current number of runs); a case that was already flaky in the baseline and now fails every run; a new case that fails every run. Only a case that was already flaky in the baseline gets the softening: it may fail some runs without blocking. Write every non-blocking failure and flaky case in the PR. When a change is meant to move a case, update the case and the baseline in the same PR.

### Answer log (`ai.chat_exchanges`)

- One row per finished exchange: `run_id` (→ `ai.runs`), `chat_id`, `created_at`, `route` (`command`, `happy`, `investigation`), `question`, `answer` (the final checked text sent to Telegram), `outcome` (`answered`, `flagged`, `fallback`, `failed`; older rows may say `redacted`), `cut_numbers` (the numbers the guard flagged; in older rows, the numbers it removed), `tool_names` and `tool_calls` (each call's tool name and its arguments as JSON, secrets redacted, at most 12 calls of 600 characters; nullable for rows written before it existed). Tool results, raw model output and secrets are never stored; text is clipped to 8000 characters.
- Written after the run row is saved, best-effort: a failed insert is logged with its reason (`Обмін для запуску … не записано: <ErrorName>`) and never touches the reply. An exchange without a run (an empty question) is not logged.
- Retention is 30 days. The daily BullMQ job `exchange-retention` (scheduler id and cron in `chat.constants.ts`, 03:17 Europe/Kyiv, on the `chat` queue) deletes older rows; it is idempotent because it deletes by a cutoff, so running it twice removes nothing more.
- `npm run chat:export --workspace=@ratingo/ai-veronica -- --since=7d [--outcome=flagged,fallback]` reads `DATABASE_URL` and prints the matching exchanges as a JSON array of eval case drafts (`id`, `question`, `requiredTools`, `reference.answer`, empty `fixtures` and `expectations`, plus an `observed` block). A person writes the fixtures and the expectations before moving a draft into `eval/chat/cases.ts`. The script only reads.

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
| «Veronica, …», a free-form question («що Хеппі сказав про 470?», «скільки PR злили за тиждень?», «глянь по коду де може бути проблема») | investigation agent; it can read Happy's result with `ask_happy` and hand a deep "why" question about the code to DUM-E with `ask_dume`                                                     |

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
5. DUM-E (done: `ask_dume`, `/why`, the follow-up).

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
- Metrics: `app.ai.runs` (agent, task, trigger, outcome), `app.ai.run.cost` (USD), `app.ai.run.tokens` (kind), `app.ai.run.duration`, `app.ai.agent.budget.day` (USD per agent, from its manifest), `app.ai.tool.calls`, `app.ai.mcp.calls` and `app.ai.mcp.call.duration` (server, tool, outcome), `app.ai.mcp.server.events` (server, event).
- Logs carry run IDs and outcomes, not prompts, PR content or chat text.
- A `Ratingo / AI` Grafana dashboard, plus the missing-digest alert.
- Watchdog heartbeat: gauge `app.ai.watchdog.last_tick_timestamp_seconds` (Prometheus `app_ai_watchdog_last_tick_timestamp_seconds`), the Unix time of the last finished watchdog tick. It is absent until the first tick, so an alert on its absence or age catches Veronica herself being down.

### Watchdog (`modules/watchdog`)

- A BullMQ scheduler `watchdog-tick` (queue `watchdog`, prefix `ai-veronica`) fires every 5 minutes. A scheduler produces one job per interval bucket, so a restart or a second replica never doubles a tick.
- Pure domain rules evaluate five alert keys for Veronica herself (nine in all with the four below): `happy_down` (`GET {HAPPY_INTERNAL_URL}/health` failed on 2 consecutive checks; skipped when the URL is unset), `digest_missing` (no `sent` row in `ai.digest_deliveries` for today's Kyiv date at or after 09:30 Europe/Kyiv, by the injected clock), `budget_agent` and `budget_chat` (spend over the rolling day window ≥ 80% of the agent's `perDayUsd` and of the chat's daily cap, read through the same `RunRepository.spentUsd` the budgets use) and `failed_runs` (≥ 3 `failed` runs of this agent in the last hour).
- Alerts fire on change only. The active keys live in Redis (`ai-veronica:watchdog-state:active`, 7 days TTL, refreshed every tick); a key that was not active and fails now sends one alert, a key that was active and is healthy now sends one «✅ відновилось». A check that cannot run (database or Redis error) is logged and leaves that key's state as it was, so an outage of the probe never counts as recovery. If Telegram fails, state is not saved and the next tick retries.
- Redis keys never live under a BullMQ queue namespace `<prefix>:<queue>:` (for example `ai-veronica:watchdog:`): BullMQ owns every key there. Watchdog state uses `ai-veronica:watchdog-state:*`, and a spec checks every key the app builds against all its queues.
- Before 09:30 a missing digest is «not evaluated», so an alert that was raised yesterday stays active across midnight until today's digest is sent.
- **Happy and DUM-E from Prometheus.** Four more alert keys, `budget_happy`, `budget_dume`, `failed_runs_happy` and `failed_runs_dume`, use the same Redis state and the same fire-on-change and recovery logic. One read per tick asks Prometheus for `sum by (agent) (increase(app_ai_run_cost_USD_sum[24h]))`, `sum by (agent) (increase(app_ai_runs_total{outcome=~"model_error|unexpected_error"}[1h]))` and the daily budget each agent publishes as `app_ai_agent_budget_day_USD` (read with `last_over_time` over a day) from its own manifest, so no budget is written twice. Spend at or above 80% of that budget, or 3 failed runs in the last hour, alerts. The spend window is rolling (24 hours) while DUM-E enforces its budget per UTC day, so the alert is an early warning and not the enforcement point. The alert texts name the Railway service (`happy`, `dume`). A Prometheus error, or an agent that spent money but publishes no budget, leaves that key's state as it was and is logged with the reason; an agent with no series counts as having spent nothing.
- **Known gaps.** A run killed before it ends records nothing in `app_ai_*` (its spend is still in Redis and its request is `failed: interrupted`). `increase()` extrapolates and misses the first sample of a new series, so thresholds are approximate, which is why failed runs are rounded. Veronica's own budget and failed-run checks stay on her Postgres table, so nothing alerts twice.

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
7. **DUM-E:** read-only investigation across code, logs, metrics and data, as its own service, in four steps: code reading and its eval (done), logs, job failures and metrics tools in the core, Veronica delegating in the background, read-only catalog data.
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
