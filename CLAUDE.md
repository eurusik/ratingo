# CLAUDE.md

Ratingo — Ukrainian-language streaming content discovery service. NPM workspaces + Turborepo monorepo.

## Key Rules
- Keep domain layer pure: only interfaces, entities, constants — use injected `ClockService` instead of `Date`, constants instead of `process.env`
- Import across modules through `module/public/` barrel exports only
- Use `import type { components } from '@ratingo/api-contract'` for all API types on frontend
- Run `npm run contracts:update` after any DTO or controller change
- Don't write comments in code or config (no inline, JSDoc, or YAML comments) — make names and structure explain the code instead. Leave existing comments alone unless you're rewriting that code

## Review After Every Step
After finishing each step, review the changed code before moving on, and fix what the reviews find:
1. A regular code review (`code-review` skill)
2. A review against the `clean-code` skill
3. Backend (`apps/api`): also against the `clean-ddd-hexagonal` skill (Clean Architecture)
4. Frontend (`apps/web-client`): also against the Vercel skills — `vercel-react-best-practices` and `web-design-guidelines`

## Layout
- `apps/api/` — NestJS + Fastify + Drizzle ORM + PostgreSQL
- `apps/web-client/` — Next.js 16 + React 19 + TanStack Query v5
- `apps/storefront/` — the public site being rewritten (Next.js 16, FSD v2.1): routes in the root `app/`, FSD layers in `src/` (`app`, `pages`, `widgets`, `features`, `entities`, `shared`), boundaries checked by Steiger (`npm run lint:fsd --workspace=storefront`, Node >= 22.18); the empty root `pages/` keeps Next from routing `src/pages`. Env is read only in `src/shared/config`
- `apps/pg-backup/` — daily `pg_dump` of prod to the Railway bucket (Railway cron service `Backup CRON`, own Dockerfile)
- `packages/api-contract/` — Shared OpenAPI types (auto-generated)
- `packages/web-core/` — Framework-agnostic web code shared by the web apps (`@ratingo/web-core/{api,auth,query,i18n,lib}`): no `next/*` imports, no `process.env`, config passed in by the app

## Branches & Deploy
- Open PRs against `development` (not `main`); promote with a release PR `development` → `main`
- `development` deploys to Railway dev, `main` deploys to Railway production; hotfixes go to `main`, then back-merge into `development`
- CI (`.github/workflows/ci.yml`) only validates: api lint/typecheck, unit tests (2 shards) and e2e tests, web lint/typecheck/tests, storefront lint + Steiger/typecheck/tests/build/knip, dead code in api and web (`api-dead-code`/`web-dead-code`, knip), contract drift, pg-backup lint/typecheck/tests, `web-smoke` (on PRs that touch the web client or `e2e/smoke/`: waits up to 15 min for the PR's Vercel preview, then runs the Playwright smoke suite against it with the `VERCEL_AUTOMATION_BYPASS_SECRET` repo secret; a missing preview fails the job), and `api-prod-install` (builds the `deps` and `prod-deps` stages of `apps/api/Dockerfile` and loads every installed native module; runs when a `package.json`, the lockfile, `.npmrc`, `.dockerignore`, the API Dockerfile or `ci.yml` changes; on the same changes `api-audit` and `web-audit` fail on high/critical `npm audit` findings in API and web-client production deps, and `security-audit.yml` reruns both audits weekly on `main` and keeps one open `security` issue per workspace while it fails). On PRs only jobs whose paths changed run; `ci` is the single required check. Railway and Vercel do the deploys
- Vercel previews call the dev API (`api-dev.ratingo.top`), which allows `https://ratingo-<9-char hash>-eurusik.vercel.app` origins only because dev sets `CORS_ALLOW_VERCEL_PREVIEWS=true`; never set it on prod. Branch-alias URLs (`ratingo-git-*`) are not allowed — open the deployment URL
- Make every migration statement safe to re-run against existing state (`IF NOT EXISTS` / `IF EXISTS`): dev runs migrations on a fresh DB, so state conflicts surface only in prod

## Commands
```bash
# Dev
npm run dev:api                # Backend (port 3001)
npm run dev:client             # Frontend (port 3002)
npm run dev:storefront         # New storefront (port 3003)
docker-compose up              # PostgreSQL (5434) + Redis (6379)

# Quality
npm run test:api                 # Backend tests (--runInBand)
npm run test:client              # Frontend tests
npm run test:storefront          # Storefront tests
npm run test:e2e --workspace=api # Backend e2e (in-memory fakes, no Postgres/Redis needed)
npm run lint:dead-code --workspace=api # knip: unused files/exports/deps in the API (knip.json, Node >= 20.19)
npm run lint:dead-code --workspace=web-client # knip: same for the web client
BASE_URL=https://<preview>.vercel.app npm run test:smoke # read-only Playwright smoke suite (e2e/smoke) against any deployed URL; protected previews also need VERCEL_AUTOMATION_BYPASS_SECRET
npm run lint:api:fix             # Auto-fix backend lint

# Single test (from apps/api/ or apps/web-client/)
npm test -- path/to/file.spec.ts
npm test -- --testNamePattern="test name"

# Database (from apps/api/)
npm run db:generate            # Create migration
npm run db:migrate             # Apply migrations

# After DTO/controller changes
npm run contracts:update       # Regenerate OpenAPI types → packages/api-contract
```

## Backend Architecture

Each module in `apps/api/src/modules/` follows 4 layers:
```
module/
├── presentation/     # Controllers, DTOs, Swagger decorators
├── application/      # Services, workers, pipelines
├── domain/           # Pure interfaces, entities, constants
└── infrastructure/   # Repositories (Drizzle), adapters, query objects
```

- Wrap all repository DB calls with `withDbError()`
- Responses are auto-wrapped: `{ success: true, data }` / `{ success: false, error: { code, message } }`

### Core Engines
1. **Policy Engine** (`catalog-policy/domain/policy-engine.ts`) — catalog eligibility
2. **Score Calculator** (`shared/score-calculator/`) — popularity 40% (TMDB 24% + Trakt 16%) + quality 40% (avgRating 25% + voteConfidence 15%) + freshness 20%
3. **Verdict Engine** (`shared/verdict/`) — user-facing recommendations

### BullMQ
Design all jobs as idempotent. Define job types in `*.constants.ts`.

### Database Migrations
- New indexes on existing tables lock writes: `drizzle-kit migrate` wraps all pending migrations in one transaction, so `CONCURRENTLY` fails there — for a large table build the index by hand with `CREATE INDEX CONCURRENTLY` first and keep `IF NOT EXISTS` in the migration; for a small table add the `-- squawk-ignore require-concurrent-index-creation` directive above the statement (a Squawk directive, the one SQL comment this rule allows)
- Follow expand/contract pattern for breaking schema changes: add nullable column first, backfill, then add constraint
- Run `npm run lint:migrations --workspace=api` before pushing a migration: Squawk (`apps/api/.squawk.toml`) checks new/changed files in `drizzle_v2/` against `origin/development`, and CI's `migrations` job gates on it

## Frontend Architecture

- **Types**: Use `import type { components } from '@ratingo/api-contract'` for all API types
- **i18n**: Ukrainian (default) + English. Server: `getDictionary(locale)`, client: `useTranslation()` hook
- **State**: TanStack Query (server state) + Zustand (UI state) + React Context (auth, i18n)
- **Module boundaries**: `app/` and other modules import a module in `src/modules/*` only through its `index.ts`. When a heavy, route-specific part would bloat every page that uses the barrel (admin journal UI, the CSV import wizard), give it its own top-level entry (`modules/journal/admin.ts` → `@/modules/journal/admin`) and add it to `webModuleExtraEntryPoints` in the root `eslint.config.mjs`. Never add per-file exceptions

## Constitution

Source of truth: @docs/SYSTEM_MAP.md — add new entities there before merge.

### Domain Rules
- Resolve providers with `resolveCanonicalProvider()` from `ingestion/domain/constants/provider-mapping.ts`
- Load country/language lists from PolicyConfig in DB
- Log every failure with a reason
- Use constants from `catalog-policy/domain/constants/` for all evaluation reasons
- Classify content with `classifyContent()` from `catalog-policy/domain/classification.service.ts`
- Attach `EvaluationReason` to every policy decision
- Write property-based tests (fast-check) for domain logic
- Use conventional commits (`feat:`, `fix:`, `refactor:`, etc.)

## Context Preservation
When compacting, preserve: list of modified files, test commands, and job type definitions from `*.constants.ts`.
