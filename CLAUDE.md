# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ratingo is a Ukrainian-language streaming content discovery service. Monorepo with NestJS backend, Next.js frontend, and shared TypeScript types.

## Commands

### Development
```bash
npm run dev:api              # Start backend (watch mode, port 3001)
npm run dev:client           # Start frontend (port 3002)
```

### Build
```bash
npm run build:all            # Build all (turbo)
npm run build:api            # Build backend only
npm run build:client         # Build frontend only
```

### Quality
```bash
npm run lint:api             # Lint backend
npm run lint:api:fix         # Auto-fix lint issues
npm run lint:client          # Lint frontend
npm run format               # Prettier all files
npm run test:api             # Run backend tests (--runInBand)
npm run test:client          # Run frontend tests
```

### Running Single Tests (from apps/api/ or apps/web-client/)
```bash
npm test -- path/to/file.spec.ts              # Run single test file
npm test -- --testNamePattern="test name"     # Filter by test name
npm run test:watch                            # Watch mode
```

### Database (from apps/api/)
```bash
npm run db:generate          # Create new migration
npm run db:migrate           # Apply migrations
npm run db:studio            # Open Drizzle Studio
```

### API Contract
```bash
npm run contracts:update     # Regenerate OpenAPI types (run after API changes)
```

### Local Services
```bash
docker-compose up            # Start PostgreSQL (5434) + Redis (6379)
```

## Architecture

### Monorepo Layout
- `apps/api/` — NestJS + Fastify + Drizzle ORM + PostgreSQL
- `apps/web-client/` — Next.js 16 + React 19 + TanStack Query
- `packages/api-contract/` — Shared OpenAPI types (generated from backend)

### Backend Module Structure (Clean Architecture)
Each module in `apps/api/src/modules/` follows 4 layers:
```
module/
├── presentation/     # Controllers, DTOs, Swagger decorators
├── application/      # Services, workers, pipelines
├── domain/           # Pure interfaces, entities, constants (NO Nest/Drizzle)
└── infrastructure/   # Repositories (Drizzle), adapters (HTTP)
```

**Critical**: Domain layer must have zero Nest/Drizzle dependencies.

### Three Core Engines
1. **Policy Engine** (`catalog-policy/domain/policy-engine.ts`) — Catalog eligibility rules
2. **Score Calculator** (`shared/score-calculator/`) — Ratingo Score (quality + popularity + freshness)
3. **Verdict Engine** (`shared/verdict/`) — User-facing recommendations

### Key Patterns
- Provider IDs must use `resolveCanonicalProvider()` from `ingestion/domain/constants/provider-mapping.ts`
- Content classification via `classifyContent()` from `catalog-policy/domain/classification.service.ts`
- All evaluation decisions must have explicit `EvaluationReason` from `catalog-policy/domain/constants/evaluation.constants.ts`

### Background Jobs (BullMQ)
- `ingestion` queue — Movie/show import, trending sync
- `stats-queue` — Stats sync, drop-off analysis
- `catalog-policy-queue` — Policy evaluation (single-threaded)

Jobs must be idempotent. Job types defined in `*.constants.ts` files.

### Frontend Structure
```
apps/web-client/src/
├── app/              # Next.js App Router pages
├── core/             # Infrastructure (api, auth, query hooks)
├── modules/          # Feature modules (admin, auth, browse, details, home, journal, saved, settings)
└── shared/           # Components, i18n (uk/en), ui (shadcn)
```

Types imported from `@ratingo/api-contract`.

## Constitution

The `docs/SYSTEM_MAP.md` is the source of truth. Any new entity MUST be added there before merge.

### Forbidden Patterns
- Matching by provider name (use canonical ID mapping)
- Hardcoded country/language lists (use PolicyConfig in DB)
- Silent failures (always log with reason)
- Magic strings for reasons (use constants)
- Direct DB calls in domain layer

### Required Patterns
- Explicit `EvaluationReason` for every decision
- Property-based tests (fast-check) for domain logic
- Types from `@ratingo/api-contract` for frontend API calls
- Conventional commits (enforced via commitlint)
