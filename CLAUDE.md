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
- `apps/pg-backup/` — daily `pg_dump` of prod to the Railway bucket (Railway cron service `Backup CRON`, own Dockerfile)
- `packages/api-contract/` — Shared OpenAPI types (auto-generated)

## Branches & Deploy
- Open PRs against `development` (not `main`); promote with a release PR `development` → `main`
- `development` deploys to Railway dev, `main` deploys to Railway production; hotfixes go to `main`, then back-merge into `development`
- CI (`.github/workflows/ci.yml`) only validates: api lint/typecheck and tests (2 shards), web lint/typecheck/tests, contract drift, pg-backup lint/typecheck/tests. On PRs only jobs whose paths changed run; `ci` is the single required check. Railway and Vercel do the deploys
- Make every migration statement safe to re-run against existing state (`IF NOT EXISTS` / `IF EXISTS`): dev runs migrations on a fresh DB, so state conflicts surface only in prod

## Commands
```bash
# Dev
npm run dev:api                # Backend (port 3001)
npm run dev:client             # Frontend (port 3002)
docker-compose up              # PostgreSQL (5434) + Redis (6379)

# Quality
npm run test:api               # Backend tests (--runInBand)
npm run test:client            # Frontend tests
npm run lint:api:fix           # Auto-fix backend lint

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
- Use `CREATE INDEX CONCURRENTLY` for new indexes on existing tables (avoids table locks)
- Follow expand/contract pattern for breaking schema changes: add nullable column first, backfill, then add constraint

## Frontend Architecture

- **Types**: Use `import type { components } from '@ratingo/api-contract'` for all API types
- **i18n**: Ukrainian (default) + English. Server: `getDictionary(locale)`, client: `useTranslation()` hook
- **State**: TanStack Query (server state) + Zustand (UI state) + React Context (auth, i18n)

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
