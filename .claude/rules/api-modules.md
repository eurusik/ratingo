---
paths:
  - "apps/api/**"
---

# Backend Gotchas

## DI & Guards
- Use Symbol tokens for injection: `@Inject(MOVIE_REPOSITORY)`, not class-based DI
- Use `OptionalJwtAuthGuard` for endpoints that work with or without auth — `@CurrentUser()` returns `null` for anonymous
- Use `AdminJwtGuard` for admin endpoints — it checks role automatically, no manual `if (role !== 'admin')` needed
- OAuth strategies return `null` when env vars missing — don't throw on absent credentials

## Database
- Wrap all DB calls with `withDbError('operation name', this.logger, async () => { ... })`
- Soft deletes vary: some tables use `deletedAt` timestamp, others `isDeleted` boolean — check `database/schema.ts`
- JSONB fields (`videos`, `credits`) accept any shape silently — validate before storing
- Use upsert semantics in jobs (not insert) — jobs retry up to 3x with exponential backoff

## Queries & Validation
- Call `normalizeListQuery(query)` before passing list params to repositories — it splits comma-separated `genres` into arrays
- `forbidNonWhitelisted: true` is global — unknown DTO properties cause 400, not silent stripping
- Use `ErrorCode` enum from `common/enums/error-code.enum.ts` — don't invent error codes
- Throw `AppException`/`NotFoundException`/`DatabaseException`, not plain `Error` or NestJS `BadRequestException`

## Module Boundaries
- Import across modules only through `module/public/index.ts` barrels
- Check module's `exports: []` before injecting — unexported providers are internal
