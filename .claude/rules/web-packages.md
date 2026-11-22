---
paths:
  - "packages/web-core/**"
  - "packages/ui/**"
---

# Web Packages

- No `next` / `next/*` imports, no `@/` aliases, no `process.env` — the app passes config in (lint-enforced)
- Packages never import from apps
- `web-core` entries: `@ratingo/web-core/{api,auth,query,i18n,lib}`; `ui` entries include `@ratingo/ui/theme` and `/motion`
- A change here affects `storefront` and `web-client`: check both
