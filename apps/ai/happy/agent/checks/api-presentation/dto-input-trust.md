---
id: dto-input-trust
paths:
  - 'apps/api/src/modules/**/presentation/{dto,dtos,controllers}/**'
  - 'apps/api/src/app.module.ts'
  - 'apps/api/src/config/allowed-origins.ts'
  - 'apps/api/src/**/auth/**'
triggers:
  - '\b(?:context|role|state|source|isAuto\w*|autoPlan)\??\s*:'
  - '@(?:IsBoolean|Transform)\('
  - '\b(?:boolean|Boolean)\b'
  - '@Throttle\('
  - '\b(?:origins?|allowedOrigins|ALLOWED_ORIGINS)\b'
  - '@(?:IsArray|IsInt|IsNumber|Min|Max|ArrayMaxSize)\('
  - '\bhandleRequest\b'
rule: api-modules.md#DTO input
severity_cap: major
---

## What to verify

Every value that arrives from an HTTP client is untrusted. A DTO field, query parameter or header must not be able to set something the server owns, and every limit must be enforced where the input is parsed, not later in a service or in SQL.

## Evidence required

Quote the field, decorator or guard line. Name the server-owned value or limit that is affected, and show how the client value reaches it (a service that derives a flag from the field, a query that receives the number, a route with no throttle tier).

## Report only when

- A free-text field such as context, role, state or source can carry a value the server also uses internally, and the DTO does not reject it, so a client can mark its own record as system-made or automatic.
- A boolean query parameter is converted with implicit conversion or a bare Boolean(), so the string "false" becomes true.
- A new or changed route skips the throttle tier that its neighbours use, or the origin list accepts a wildcard or a looser match than before.
- A Zod schema and a class-validator DTO describe the same payload but allow different fields, so the API silently drops or rejects data.
- An array or number from the client has no maximum (no Max, ArrayMaxSize or Min) and reaches a SQL limit, offset, IN list or loop.

## Do not report

- Endpoints behind OptionalJwtAuthGuard whose handler tolerates a null user. Anonymous access is intended there.
- Fields the server overwrites before use, or values read only for logging.
- Pagination DTOs that already extend the shared offset pagination class with its maximum.

## Real bug example

The subscribe DTO accepted any string as context, and the service set the automatic-plan flag when context equalled the system value. A client could send that value, mark its own reminder as automatic and write entries into the action log that a later backfill reads. The fix made the flag an explicit field set only by the plan listener, and rejected the system context values in the DTO.

## Looks risky but fine

An optional JWT guard overrides handleRequest and returns null when there is an error or no user, instead of throwing. This is deliberate: search and catalog endpoints work for anonymous visitors and treat a null user as no personal data.
