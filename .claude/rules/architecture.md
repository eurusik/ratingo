---
paths:
  - "apps/api/src/modules/**"
  - "apps/ai/*/src/modules/**"
---

# Clean / Hexagonal Architecture Rules

## Dependency Direction
```
Presentation → Application → Domain ← Infrastructure
```
- Presentation imports application services and domain tokens/types
- Application imports domain ports/repositories/entities only — never infrastructure or presentation
- Domain imports nothing external — zero NestJS, Drizzle, HTTP deps
- Infrastructure implements domain interfaces, imports domain + database

## Port / Adapter Pattern
- Define ports as interfaces in `domain/ports/*.port.ts` with Symbol token
- Implement adapters in `infrastructure/adapters/*.adapter.ts`
- Wire via module providers: `{ provide: MEDIA_METADATA_PORT, useClass: TmdbMetadataAdapter }`
- Adapters map external types → domain types at the boundary

## Module Communication
- `public/index.ts` exports tokens, types, pure domain functions and the application services other modules inject — never Drizzle repository implementations or infrastructure code
- Import from other modules only through the `public/` barrel (or the `modules/shared/*` micro-module index)
- No circular module dependencies (`import/no-cycle` is an error): put types two modules share into `modules/shared/contracts`
- Use `EventEmitter2` events for loose coupling between modules

## Service Layer
- Application services orchestrate domain logic via injected ports/repositories
- Services receive and return domain types, not DTOs
- Services enforce domain invariants and emit domain events
- Compose services horizontally as peers — no service-of-services hierarchy

## DTO Flow
```
Request → [DTO validation] → normalizeListQuery() (catalog list endpoints only) → Service(domain types) → Repository → Mapper(raw→domain) → [Response DTO]
```
- Request DTOs: `presentation/dto/*-query.dto.ts` / `*-request.dto.ts` — validation only
- Response DTOs: `presentation/dto/*-response.dto.ts` — with `@ApiProperty` decorators
- Most modules use `presentation/dto/`; `catalog`, `home` and `insights` use `dtos/` — follow the module you are in
- Mappers: `infrastructure/mappers/` — raw DB rows → domain entities
- Query objects: `infrastructure/queries/` — encapsulate complex SQL

## Error Flow
- Application and infrastructure code throws the `AppException` family from `common/exceptions` (`NotFoundException`, `ValidationException`, `ExternalApiException`, `DatabaseException`) with an `ErrorCode` from `common/enums/error-code.enum.ts` — never plain `Error` or Nest's `BadRequestException`
- Wrap repository DB calls with `withDbError()` → `DatabaseException`
- Domain code stays HTTP-free: domain errors extend `Error` in `domain/errors/`; the module maps them to HTTP in a `presentation/filters/` exception filter (see `catalog-policy` dry-run and policy-activation filters)
- Responses are wrapped by the global filter/interceptor: `{ success: true, data }` / `{ success: false, error: { code, message } }`

## New Module Checklist
```
module/
├── domain/
│   ├── repositories/    # Interface + Symbol token
│   ├── ports/           # External service contracts
│   ├── entities/        # Interfaces (not classes)
│   ├── constants/       # as const objects + derived types
│   └── errors/          # Extend Error, add code property
├── application/
│   └── services/        # Orchestrate via @Inject(TOKEN)
├── infrastructure/
│   ├── repositories/    # Drizzle implementations
│   ├── adapters/        # Port implementations
│   ├── queries/         # Complex SQL query objects
│   └── mappers/         # Raw row → domain entity
├── presentation/
│   ├── controllers/     # HTTP endpoints
│   ├── dto/             # Validation + Swagger
│   └── filters/         # Domain error → HTTP mapping
├── public/
│   └── index.ts         # Barrel: tokens, types, injectable services
└── <module>.module.ts   # Wire Symbol → implementation
```
