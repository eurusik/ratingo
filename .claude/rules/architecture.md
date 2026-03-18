---
paths:
  - "apps/api/src/modules/**"
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
- Expose only tokens + types via `public/index.ts` — never implementations
- Import from other modules only through `public/` barrel
- Use `forwardRef(() => Module)` for circular dependencies
- Use `EventEmitter2` events for loose coupling between modules

## Service Layer
- Application services orchestrate domain logic via injected ports/repositories
- Services receive and return domain types, not DTOs
- Services enforce domain invariants and emit domain events
- Compose services horizontally as peers — no service-of-services hierarchy

## DTO Flow
```
Request → [DTO validation] → normalizeListQuery() → Service(domain types) → Repository → Mapper(raw→domain) → [Response DTO]
```
- Request DTOs: `presentation/dtos/*-query.dto.ts` / `*-request.dto.ts` — validation only
- Response DTOs: `presentation/dtos/*-response.dto.ts` — with `@ApiProperty` decorators
- Mappers: `infrastructure/mappers/` — raw DB rows → domain entities
- Query objects: `infrastructure/queries/` — encapsulate complex SQL

## Error Flow
- Domain errors: extend `Error` in `domain/errors/` — pure, no HTTP concepts
- Exception filters in `presentation/filters/` map domain errors → HTTP responses
- Infrastructure errors: wrap with `withDbError()` → `DatabaseException`
- Application layer throws domain errors, presentation layer catches and maps

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
│   ├── dtos/            # Validation + Swagger
│   └── filters/         # Domain error → HTTP mapping
├── public/
│   └── index.ts         # Barrel: tokens + types only
└── module.ts            # Wire Symbol → implementation
```
