# DUM-E

Answers "why does the system behave like this" from the code of one commit of the repository, with citations that are checked. Steps 1 and 2 of four: code reading plus read-only runtime data (logs, failed jobs, metrics), run from the command line and from its eval. Design: [`apps/ai/ARCHITECTURE.md`](../ARCHITECTURE.md) (section `apps/ai/dume`).

```bash
npm run investigate --workspace=@ratingo/ai-dume -- "Чому джоба X не падає?" --ref=main
npm run eval --workspace=@ratingo/ai-dume
npm test --workspace=@ratingo/ai-dume
```

Without `AI_MODEL_REVIEW` and `ANTHROPIC_API_KEY` the model is a stub that answers "nothing was checked". For a real run set `AI_MODEL_REVIEW=anthropic:claude-sonnet-5-5` and `ANTHROPIC_API_KEY`. `DUME_LOCAL_CHECKOUT=<path>` reads a local checkout instead of downloading the commit from GitHub.

Read-only: three code tools (`code_search`, `code_read`, `code_list`) and the three runtime tools it shares with Veronica from `@ratingo/ai-ops-tools` (`logs_search`, `job_failures`, `metrics_query`), no shell, nothing from the repository is executed. File content and log text reach the model inside `<untrusted>` blocks. Each runtime tool is off, and says so when called, until its variables are set: `GRAFANA_LOKI_URL`, `GRAFANA_LOKI_USER` and `GRAFANA_LOKI_TOKEN` for logs, `AI_READER_DATABASE_URL` for failed jobs, `GRAFANA_PROM_URL` and `GRAFANA_PROM_TOKEN` for metrics. A claim can cite a log or metric row by the `ref` the tool returned; it is a fact only if the tool showed that row in the same run.

The eval cases keep a file and an anchor text for each fact. When a code change makes the stub run fail with `StaleCaseError`, open the named file, find the new place of the fact and update the case's `anchor` and `verifiedAt`; do not loosen the check.
