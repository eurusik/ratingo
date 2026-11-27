# @ratingo/ai-ops-tools

Read-only operational tools that more than one agent needs: `logs_search` (Grafana Cloud Loki), `job_failures` (the `reporting.daily_job_failures` view through the `ai_reader` role), `metrics_query` (named PromQL templates on Grafana Cloud Prometheus), and `db_schema` with `db_query` (one read-only `SELECT` over the application tables through the `ai_explorer` role, which keeps private data closed in the database itself). Veronica and DUM-E build the same tools from here, so a tool has one description, one set of limits and one output shape. Design: [`apps/ai/ARCHITECTURE.md`](../../apps/ai/ARCHITECTURE.md).

It has no Nest imports, never reads `process.env` and never calls `Date`: each agent passes in its connections, a `ClockPort` and an optional logger. It depends on `@ratingo/ai-core` and knows Ratingo (service names, metric names, the view), which is why it is a separate package and not part of the core.

```bash
npm test --workspace=@ratingo/ai-ops-tools
npm run lint --workspace=@ratingo/ai-ops-tools
npm run typecheck --workspace=@ratingo/ai-ops-tools
npm run lint:dead-code --workspace=@ratingo/ai-ops-tools
```

## Layout

| Folder          | Contents                                                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logs/`         | LogQL builder, log record parsing and grouping, the Loki adapter, the unconfigured adapter, `LogsSearchExecutor`, the input schema                                                                                                           |
| `job-failures/` | `JobFailuresPort`, the Postgres adapter and its reader connection, the unconfigured adapter, `JobFailuresExecutor`                                                                                                                           |
| `metrics/`      | `MetricsPort`, the Prometheus adapter, PromQL builders, the metric templates, schedule wording, `MetricsQueryExecutor`                                                                                                                       |
| `database/`     | `ExplorerPort`, the Postgres adapter, the SQL statement policy, failure classes, `DbSchemaExecutor`, `DbQueryExecutor`, the input schemas                                                                                                    |
| `shared/`       | window and name parsing, `InvalidOpsInputError`                                                                                                                                                                                              |
| `time/`         | Kyiv time formatting and Kyiv day                                                                                                                                                                                                            |
| `tools/`        | `createOpsTools(executors, { decorate })` returns the five `Tool`s; `decorate` lets an agent change an executor's result before it is serialised                                                                                             |
| `testing/`      | `createLokiSimulator`, `createPrometheusSimulator`, `createJobFailuresSimulator` from the package root; the Postgres helpers for evals (`ExplorerEvalSession`, `ExplorerEvalRuntime`, the fixture) only from `@ratingo/ai-ops-tools/testing` |

The tests of the database tools run against a real Postgres when `EXPLORER_TEST_DATABASE_URL` is set (an admin URL; the helper creates and drops its own database) and are skipped otherwise. A capability folder never imports another one; `tools/` and `testing/` sit on top.

## Behaviour that must not drift

- A port that is not configured is an `Unconfigured*` adapter. Its tool stays offered and answers with an error that names the reason (`logs_search is unavailable: not_configured`), so a missing key is an answer, not a crash.
- Every failure of a port is an `...UnavailableError` with a reason; the log executor also writes the reason to the logger it was given.
- An empty result says what it does and does not cover (`nothingRecordedNote`, the descriptions' sentences about empty lists).
- Veronica's tool definitions and outputs are pinned by `ops-tools.golden.spec.ts` in her chat module. Change a description or an output only together with that snapshot, on purpose.
