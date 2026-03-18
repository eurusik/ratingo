---
paths:
  - "apps/api/src/modules/*/domain/**"
---

# Domain Layer Rules

## Purity
- Use injected `ClockService` (`CLOCK_PORT`) for time — never `new Date()` or `Date.now()`
- Use domain constants for all decisions — never magic strings or numbers
- Define entities as interfaces, not classes
- Throw domain-specific errors (extend `Error`), not `HttpException` or `AppException`

## DI Tokens
- Define in repository/port interface files: `export const MEDIA_REPOSITORY = Symbol('MEDIA_REPOSITORY')`
- Naming: `{RESOURCE}_REPOSITORY`, `{RESOURCE}_PORT`, `{RESOURCE}_SERVICE`

## Constants
- Use `as const` objects with derived types:
  ```ts
  export const EligibilityStatus = { ELIGIBLE: 'eligible', INELIGIBLE: 'ineligible' } as const;
  export type EligibilityStatusType = (typeof EligibilityStatus)[keyof typeof EligibilityStatus];
  ```
- Evaluation reasons: use only values from `EvaluationReason` in `catalog-policy/domain/constants/`
- Evaluation contexts: `catalog`, `trending`, `homepage`, `now_playing`, `new_digital`, `search`

## Policy Engine
- Input: `PolicyEngineInput` with mediaItem + stats
- Output: `Evaluation` with status + reasons array + breakoutRuleId
- Every evaluation MUST have at least one reason — never silent pass/fail
