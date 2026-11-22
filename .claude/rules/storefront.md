---
paths:
  - "apps/storefront/**"
---

# Storefront

## Structure
- FSD v2.1 layers in `src/`: `app`, `pages`, `widgets`, `features`, `entities`, `shared`; routes live in the root `app/`, and the root `pages/` holds only a README so Next doesn't route `src/pages`
- Import a slice only through its index file; a layer imports only layers below it
- Run `npm run lint:fsd --workspace=storefront` (Steiger, Node >= 22.18) after structural changes
- Read env only in `@/shared/config`; the one exception is the inline `process.env.NEXT_RUNTIME === 'nodejs'` checks in the root `instrumentation.ts`, which keep the OpenTelemetry SDK out of edge bundles
- Read the Next.js docs in `node_modules/next/dist/docs/` before using an API: this Next has breaking changes

## UI and i18n
- Tailwind 4 with `@ratingo/ui` (`@ratingo/ui/theme`, `/motion`), not `cinema-*` tokens
- Shared HTTP, auth, query and i18n helpers come from `@ratingo/web-core/*`; the app passes config in
- Dictionaries are `src/shared/i18n/locales/uk.json` and `en.json`: add every key to both; server code uses `getDictionary(locale)`
- API types come from `@ratingo/api-contract`

## SSR memory
- Never give server-side queries a long `gcTime` (the server `QueryClient` lives for the process and grew prod web from 1 GB to 6 GB); don't use `Infinity` on the server
- ISR `initialData` needs `initialDataUpdatedAt`, otherwise the client treats stale data as fresh
- Keep `next.config` cache keys and ISR variants bounded: every distinct key is held in memory or on disk, and crawlers hit them all

## Cache coherence
- After a mutation invalidate the broad list prefix, not only the item key
- Clear user-scoped caches on logout and when the user switches
