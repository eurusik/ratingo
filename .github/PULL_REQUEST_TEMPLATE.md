## Description

<!-- Brief: what changed and why -->
<!-- If behavior changed: describe what was before and what is now -->

## Type of Changes

- [ ] 🐛 Bug fix
- [ ] ✨ New feature
- [ ] ♻️ Refactoring (no behavior change)
- [ ] �  Documentation
- [ ] 🔧 Configuration
- [ ] 🧪 Tests

## Checklist

### Required

- [ ] Code compiles without errors (`npm run build:api`)
- [ ] Linter passed (`npm run lint:api`)
- [ ] Tests passed (`npm run test:api`)
- [ ] Business behavior change described (if any)

### Code Style

- [ ] No magic strings — constants/enums used
- [ ] No magic numbers — extracted to named constants
- [ ] Boolean params replaced with options object
- [ ] Early returns instead of nested conditions
- [ ] Imports sorted (`eslint --fix`)

### Architecture

- [ ] Domain doesn't depend on infrastructure
- [ ] Cross-module imports only through `public/`
- [ ] Typed errors instead of `throw new Error()`
- [ ] Domain functions are pure (no side effects)

### If Refactoring

- [ ] No behavior change (or explicitly documented)
- [ ] Tests still pass without modification

### If API Changes

- [ ] DTO validation via class-validator
- [ ] Swagger docs updated
- [ ] Contracts generated (`npm run contracts:update`)

### If DB Changes

- [ ] Migration created (`npm run db:generate`)
- [ ] Migration tested locally
- [ ] Indexes added where needed

### If Background Jobs / Queues

- [ ] Job is idempotent
- [ ] Retry / failure strategy considered
- [ ] Job naming follows convention (`sync-movie`, `analyze-stats`)

## Screenshots / Logs

<!-- If relevant -->

## Related Issues

<!-- Closes #123 -->
