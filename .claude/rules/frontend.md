---
paths:
  - "apps/web-client/**"
---

# Frontend Gotchas

## API Types
Use `import type { components } from '@ratingo/api-contract'` for all API types.
If a type doesn't exist, run `npm run contracts:update` after backend changes.

## Queries
- Use `getQueryClient()` from `core/query/client.ts` — returns singleton on browser, fresh instance on server
- Normalize undefined to null in query keys: `queryKey: ['media', id, sort ?? null]`
- Use `retryUnlessUnauthorized` from `core/query/utils.ts` for query retry config
- Follow `onMutate` + `onError` rollback pattern from `core/query/saved-items.ts` for optimistic updates

## Auth
- 401 recovery is built into `core/api/client.ts` — don't add custom retry/refresh logic in mutations
- Token injection is automatic via `setTokenGetter()` — don't manually add Authorization headers
- Admin routes have no automatic guard — check `isAdmin` from `useAuth()` and handle 403

## i18n
- Server components: `getDictionary('uk')` — Client components: `useTranslation()` hook
- Add new keys to BOTH `shared/i18n/locales/uk.json` and `en.json`
- Form validation schemas that use translations: recreate with `useMemo(() => createSchema(dict), [dict])`

## Styling
- Dark mode only — no light mode variants
- Use `cinema-*` color tokens from `tailwind.config.ts`, not raw hex values
- Merge classes with `cn()` from `shared/utils/cn.ts`, not template literals

## Routing
- Pages using `useSearchParams()` need a Suspense boundary at the page level
- Journal mutations use server actions with `revalidatePath()`, separate from TanStack Query cache
