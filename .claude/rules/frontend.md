---
paths:
  - "apps/web-client/**"
---

# Web Client Gotchas

## API Types
Use `import type { components } from '@ratingo/api-contract'` for all API types.
If a type doesn't exist, run `npm run contracts:update` after backend changes.

## Queries
- Use `getQueryClient()` and `retryUnlessUnauthorized` from `@ratingo/web-core/query`
- Normalize undefined to null in query keys: `queryKey: ['media', id, sort ?? null]`
- Optimistic `onMutate` + `onError` snapshot rollback (pattern in `core/query/saved-items.ts`) is for a mutation that is one request. For multi-request or chunked mutations, don't roll back: invalidate or refetch on settle, because a snapshot restore overwrites the parts that succeeded

## Auth
- 401 refresh lives in `@ratingo/web-core/api` (the app calls `configureApiClient`) — don't add custom retry/refresh logic in mutations
- Token injection is automatic via `setTokenGetter()` — don't manually add Authorization headers
- Admin routes have no automatic guard — check `isAdmin` from `useAuth()` and handle 403

## i18n
- Server components: `getDictionary(locale)` — Client components: `useTranslation()` hook
- Add new keys to BOTH `shared/i18n/locales/uk.json` and `en.json`
- Form validation schemas that use translations: recreate with `useMemo(() => createSchema(dict), [dict])`

## State & Modules
- TanStack Query holds server state, Zustand UI state, React Context auth and i18n
- `app/` and other modules import a module in `src/modules/*` only through its `index.ts`. A heavy route-specific part (admin journal UI, CSV import wizard) gets its own entry (`modules/journal/admin.ts` → `@/modules/journal/admin`) listed in `webModuleExtraEntryPoints` in the root `eslint.config.mjs`. Never add per-file exceptions

## Styling
- Dark mode only — no light mode variants
- Use `cinema-*` color tokens from `tailwind.config.ts`, not raw hex values
- Merge classes with `cn()` from `@/shared/utils` (re-export of web-core lib), not template literals

## Routing
- Pages using `useSearchParams()` need a Suspense boundary at the page level
- Journal mutations use server actions with `revalidatePath()`, separate from TanStack Query cache

## Deploy
- Runs on Railway as `web` (`apps/web-client/Dockerfile`, standalone), serving `admin.ratingo.top`; `APP_ENV=production` enables search indexing, any other value blocks it
- `NEXT_PUBLIC_*` vars are build args: changing one needs a rebuild
