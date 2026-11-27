# CLAUDE.md

Ratingo — Ukrainian-language streaming content discovery service. NPM workspaces + Turborepo monorepo. Path-scoped rules live in `.claude/rules/`; design docs are `apps/api/src/ARCHITECTURE.md`, `apps/ai/ARCHITECTURE.md` and `apps/api/src/modules/*/README.md`.

## Key Rules
- Keep domain layer pure: only interfaces, entities, constants — use `CLOCK_PORT` instead of `Date`, constants instead of `process.env`
- Import across modules through `module/public/` barrel exports only
- Use `import type { components } from '@ratingo/api-contract'` for all API types on frontend
- Run `npm run contracts:update` after any DTO or controller change, and `npm run system-card:update` after changing a scheduled job, queue or external provider
- Don't write comments in code or config (no inline, JSDoc, or YAML comments) — make names and structure explain the code instead. Leave existing comments alone unless you're rewriting that code
- Use conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`)

## Review After Every Step
Review the changed code before moving on and fix what the reviews find, using the user-installed skills `code-review`, `clean-code`; backend (`apps/api`) also `clean-ddd-hexagonal` and `nestjs-best-practices`; frontend (`apps/storefront`, `apps/web-client`, web packages) also `vercel-react-best-practices` and `web-design-guidelines`, plus `feature-sliced-design` for the storefront. If a skill is unavailable, review against this file and `.claude/rules`.

## Layout
- `apps/api/` — NestJS + Fastify + Drizzle ORM + PostgreSQL + BullMQ
- `apps/web-client/` — Next.js 16 + React 19 + TanStack Query v5 (admin and legacy site)
- `apps/storefront/` — the public site: Next.js 16, FSD v2.1; rules in `.claude/rules/storefront.md`
- `apps/pg-backup/` — daily `pg_dump` of prod to the Railway bucket
- `apps/ai/veronica/`, `apps/ai/happy/`, `apps/ai/dume/` — AI agents (daily ops digest, PR reviewer, code investigator); they import only `@ratingo/ai-core` and `@ratingo/node-telemetry`, never each other; see `apps/ai/ARCHITECTURE.md`
- `packages/ai-core/` — agent platform: model ports, tools, agent loop, budgets, runs
- `packages/node-telemetry/` — OpenTelemetry conventions shared by the API and the storefront; renaming a metric or label breaks the Grafana dashboards and alerts
- `packages/web-core/`, `packages/ui/` — framework-agnostic code shared by the web apps
- `packages/api-contract/` — OpenAPI types (auto-generated)

## Branches & Deploy
- Open PRs against `development` (not `main`); promote with a release PR `development` → `main`; hotfixes go to `main`, then back-merge into `development`
- `development` deploys to Railway dev, `main` to Railway production. `ratingo.top` is served by the storefront, `admin.ratingo.top` by `web-client`
- CI (`.github/workflows/ci.yml`) only validates; on PRs only jobs whose paths changed run, and `ci` is the single required check. Read `ci.yml` for the job list

## Commands
```bash
docker-compose up postgres-v2 redis   # PostgreSQL (5434, db ratingo_v2) + Redis (6379)
npm run dev:api                       # Backend (3001)
npm run dev:client                    # web-client (3002)
npm run dev:storefront                # storefront (3003)

npm run lint:api | lint:client | lint:storefront
npm run test:api | test:client | test:storefront
npm run test:e2e --workspace=api      # in-memory fakes, no Postgres/Redis
npm run lint:dead-code --workspace=<api|web-client>
npm run lint:fsd --workspace=storefront
BASE_URL=http://localhost:3002 npm run test:smoke   # read-only Playwright smoke suite
npm run lint:migrations --workspace=api
npm run contracts:update              # after DTO/controller changes
npm run system-card:update            # after changing scheduled jobs, queues or providers (Veronica's system card)

npm test -- path/to/file.spec.ts      # single test, from the workspace
npm run db:generate | db:migrate      # from apps/api/
```

## Constitution
- Map providers through the provider module: `ProviderMappingService.resolve/resolveMany`, `NormalizationService` from `provider/public`, the `provider_mappings` table
- Load country/language lists from PolicyConfig in DB
- Log every failure with a reason
- Use constants from `catalog-policy/domain/constants/` for all evaluation reasons, and attach an `EvaluationReason` to every policy decision
- Classify content with `classifyContent()` from `catalog-policy/domain/classification.service.ts`
- Write property-based tests (fast-check) for domain logic
- Document new entities in the owning module's README (or `apps/api/src/ARCHITECTURE.md` for cross-module ones) before merge

## Context Preservation
When compacting, preserve: list of modified files, test commands, and queue/job definitions (`modules/shared/contracts/queues.ts`, `ingestion-jobs.ts`, or the owning module's constants).
