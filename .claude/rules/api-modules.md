---
paths:
  - "apps/api/**"
---

# Backend Gotchas

## DI & Guards
- Use Symbol tokens for injection: `@Inject(MOVIE_REPOSITORY)`, not class-based DI
- Use `OptionalJwtAuthGuard` for endpoints that work with or without auth — `@CurrentUser()` returns `null` for anonymous
- Use `AdminJwtGuard` for admin endpoints — it checks role automatically, no manual `if (role !== 'admin')` needed
- The Google and Facebook OAuth providers in `auth.module.ts` resolve to `null` when their env vars are missing — don't throw on absent credentials

## Database
- Wrap all repository DB calls with `withDbError('operation name', this.logger, async () => { ... })`
- Schema lives in `database/schema/*.ts`; soft deletes vary (`deletedAt` timestamp on some tables, `isDeleted` boolean on others) — check the table
- JSONB fields (`videos`, `credits`) accept any shape silently — validate before storing
- Use upsert semantics in jobs (not insert): the shared default is 3 attempts with exponential backoff, some queues configure more

## Queries & Validation
- `normalizeListQuery(query)` applies to catalog list endpoints only: it splits comma-separated `genres` into arrays
- `forbidNonWhitelisted: true` is global — unknown DTO properties cause 400, not silent stripping
- Use `ErrorCode` from `common/enums/error-code.enum.ts` — don't invent error codes
- Which exception to throw is in `architecture.md` (Error Flow)

## Module Boundaries
- Import across modules only through `module/public/index.ts` barrels
- Check the module's `exports: []` before injecting — unexported providers are internal

## Core Engines
- Policy Engine (`catalog-policy/domain/policy-engine.ts`) decides catalog eligibility
- Score Calculator (`shared/score-calculator/`): popularity 40% (TMDB 24% + Trakt 16%) + quality 40% (avgRating 25% + voteConfidence 15%) + freshness 20%
- Verdict Engine (`shared/verdict/`) produces user-facing recommendations

## BullMQ Basics
- Design every job to be idempotent
- Queue names and job types live in `modules/shared/contracts` (`queues.ts`, `ingestion-jobs.ts`) or the owning module's constants
