# Catalog Module

The **Catalog Module** is Ratingo's primary data access and query layer for streaming media. It powers all public-facing endpoints: trending lists, movie/show details, search, on-demand import, episode calendar, and provider discovery.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Concepts](#core-concepts)
- [Module Structure](#module-structure)
- [Data Flows](#data-flows)
- [Public API](#public-api)
- [Endpoints](#endpoints)
- [Testing](#testing)

## Overview

### Responsibilities

- **Trending & Popular Lists** — Movies and shows sorted by engagement metrics (freshness, quality, watchers)
- **Media Details** — Full movie/show information with user-specific enrichment and verdicts
- **Hybrid Search** — Parallel local DB + TMDB search with deduplication
- **On-Demand Import** — Async TMDB import with job tracking (BullMQ)
- **Episode Calendar** — TV show release schedule grouped by day
- **Hero Selection** — Homepage featured media (2-pass strict → fallback)
- **Provider Discovery** — Streaming service listings

### Key Features

- **Enrichment pipeline** — Raw results → user state → card metadata → verdict → response
- **Degraded state detection** — Graceful fallback when policy evaluations are missing
- **Multi-level deduplication** — In-memory locks, deterministic job IDs, unique DB constraints
- **Stats preservation** — Prevents 0 overwrites from API failures (Trakt watchers sync)
- **Cursor pagination** — Memory-efficient iteration for batch sync operations

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       PRESENTATION LAYER                          │
│                                                                    │
│   MoviesController   ShowsController   SearchController            │
│   ProvidersController                                              │
│                                                                    │
│   DTOs (20+)  │  Filters  │  Validators  │  Utils                  │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│                       APPLICATION LAYER                             │
│                                                                     │
│   Services:                                                         │
│   • MovieDetailsService       • ShowDetailsService                  │
│   • CatalogSearchService      • CatalogImportService                │
│   • CatalogUserStateEnricher                                        │
│                                                                     │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│                         DOMAIN LAYER                                │
│                                                                     │
│   Repositories (interfaces):   Ports:                               │
│   • IMediaRepository (28)      • IImportJobPort                     │
│   • IMovieRepository (9)       • IMediaMetadataPort                 │
│   • IShowRepository (9)        • IUserStateProvider                 │
│   • IGenreRepository (1)                                            │
│   • IProvidersRepository (1)   Types │ Constants │ Errors │ Utils   │
│                                                                     │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│                      INFRASTRUCTURE LAYER                           │
│                                                                     │
│   Repositories (Drizzle):      Adapters:                            │
│   • DrizzleMediaRepository     • BullMQImportJobAdapter             │
│   • DrizzleMovieRepository     • TmdbMetadataAdapter                │
│   • DrizzleShowRepository      • UserStateAdapter                   │
│   • DrizzleGenreRepository     • HeroRepositoryAdapter              │
│   • ProvidersRepository                                             │
│                                                                     │
│   Query Objects (13):          Shared Builders (7) + Mappers (10)   │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Enrichment Pipeline

Every list and detail endpoint follows the same pipeline:

```
DB Query → User State Enrichment → Card Metadata → Verdict → Response
```

| Step | Service | What it does |
|------|---------|-------------|
| 1. Query | Repository | Fetch raw data with joins, filters, pagination |
| 2. User State | CatalogUserStateEnricher | Batch-fetch user ratings/watchlist (no N+1) |
| 3. Cards | CardEnrichmentService | Add badges (trending, new, hit), continue points |
| 4. Verdict | VerdictEngine | Quality/rating/popularity recommendations (details only) |

### Query Object Pattern

Complex SQL is encapsulated in single-purpose query classes. Each query owns its SELECT fields, WHERE conditions, and result mapping:

```
TrendingMoviesQuery
├── MovieSelectFields        (SELECT clause)
├── TrendingConditionsBuilder (WHERE clause)
├── SortOrderBuilder         (ORDER BY clause)
├── MovieResultMapper        (Row → Domain type)
└── GenreQuery               (Batch genre fetch)
```

Shared builders are composed across queries — `TrendingConditionsBuilder` is reused by movies and shows, `SortOrderBuilder` by all list endpoints.

### Degraded State

When catalog-policy evaluations are missing (e.g. during re-evaluation), queries detect this and return a degraded response:

```typescript
TrendingQueryMeta {
  degraded?: boolean;      // true = evaluations incomplete
  degradedReason?: string; // "No TRENDING evaluations found"
}
```

The UI can display a fallback or loading state instead of empty results.

### Slug Collision Handling

Media slugs must be unique per type. The module handles collisions at multiple levels:

| Level | Strategy |
|-------|----------|
| Generation | `generateSlug(title, tmdbId)` via slugify (Ukrainian locale) |
| DB Constraint | `UNIQUE(type, slug)` — catches race conditions |
| Retry | On conflict, appends tmdbId suffix: `fight-club` → `fight-club-550` |
| Fallback | Empty/null title → `tmdb-{tmdbId}` |

### Stats Preservation

External APIs sometimes return 0 for watchers during outages. The module detects this and preserves the existing DB value:

```typescript
preserveTotalWatchers(value) // 0 → keeps existing, >0 → updates
```

## Module Structure

```
catalog/
├── presentation/                # HTTP layer
│   ├── controllers/             # 4 controllers (movies, shows, search, providers)
│   ├── dtos/                    # 20+ DTOs with @ApiProperty decorators
│   ├── filters/                 # CatalogDomainExceptionFilter (→ 404/500)
│   ├── mappers/                 # SearchMapper (domain → DTO)
│   ├── utils/                   # pagination, query normalization, calendar grouping
│   └── validators/              # @IsYearRange custom validator
│
├── application/                 # Business logic orchestration
│   └── services/                # 5 services (import, search, enricher, movie/show details)
│
├── domain/                      # Pure business logic (zero Nest/Drizzle deps)
│   ├── constants/               # Thresholds, weights, sort/filter enums
│   ├── errors/                  # MovieNotFoundError, ShowNotFoundError
│   ├── ports/                   # IImportJobPort, IMediaMetadataPort, IUserStateProvider
│   ├── repositories/            # 5 repository interfaces
│   ├── types/                   # Query, enrichment, import, search, details types
│   └── utils/                   # Slug generation, release status computation
│
├── infrastructure/              # External integrations
│   ├── adapters/                # BullMQ, TMDB, UserState, Hero bridges
│   ├── mappers/                 # Persistence mappers (domain ↔ Drizzle)
│   ├── queries/                 # 13 query objects + 17 shared builders/mappers
│   ├── repositories/            # 5 Drizzle ORM implementations
│   └── utils/                   # Transaction helper, persistence utils
│
├── public/                      # Module boundary — exports for other modules
│   └── index.ts
│
└── catalog.module.ts            # NestJS module (4 controllers, 5 services, 17+ providers)
```

## Data Flows

### Trending Movies

```
GET /catalog/movies/trending?limit=20&genres=28

1. CatalogMoviesController
   → normalizeListQuery() + applyPaginationDefaults()

2. IMovieRepository.findTrending()
   → TrendingMoviesQuery:
     ├─ JOIN movies + mediaItems + evaluations (ELIGIBLE + TRENDING context)
     ├─ TrendingConditionsBuilder (freshness, quality, genre, year filters)
     ├─ SortOrderBuilder (trending score)
     ├─ GenreQuery.fetchForMediaItems() (parallel)
     ├─ Check: evaluations exist? (degraded state detection)
     └─ MovieResultMapper → TrendingMovieItem[] (isNew, isClassic flags)

3. CatalogUserStateEnricher.enrichItemList()
   → Batch IUserStateProvider.findMany()

4. CardEnrichmentService.enrichCatalogItems()
   → Add badge, trend delta

5. Return { data: [...], meta: { total, limit, offset, hasMore, degraded? } }
```

### On-Demand Import

```
POST /catalog/import/movie/550           (Fight Club)

1. CatalogImportService.importMedia(550, MOVIE)
2. Check in-memory lock (deduplication)
3. Check DB: findByTmdbId(550)
   ├─ If READY → return { status: 'ready', slug }
   ├─ If IMPORTING + job exists → return { status: 'importing', jobId }
   └─ If IMPORTING + no job → re-queue (stuck recovery)

4. Not in DB:
   ├─ IMediaMetadataPort.getMovie(550) → { title: "Fight Club" }
   ├─ generateSlug("Fight Club", 550) → "fight-club"
   ├─ IMediaRepository.upsertStub() → { id, slug }
   └─ IImportJobPort.queueImport(550, MOVIE) → jobId: "SYNC_MOVIE_550"

5. Return { status: 'importing', id, slug, jobId }

Client polls: GET /catalog/import/status/SYNC_MOVIE_550
→ { status: 'processing' | 'ready' | 'failed', slug?, errorMessage? }
```

### Hybrid Search

```
GET /catalog/search?query=matrix

1. CatalogSearchService.search('matrix')
2. Parallel:
   ├─ IMediaRepository.search('matrix', 10)   — trigram + ILIKE (pg_trgm)
   └─ IMediaMetadataPort.searchMulti('matrix') — TMDB API
3. Dedup: remove TMDB results that exist locally (by tmdbId)
4. SearchMapper.toResponseDto()
5. Return { query, local: [...], tmdb: [...] }
```

### Movie Details

```
GET /catalog/movies/fight-club   (authenticated user)

1. MovieDetailsService.getBySlug('fight-club', userId)
2. IMovieRepository.findBySlug()
   → MovieDetailsQuery: full data + genres + credits + availability + stats
3. Throw MovieNotFoundError if null → CatalogDomainExceptionFilter → 404
4. CatalogUserStateEnricher.enrichOne() → user rating, watchlist state
5. CardEnrichmentService → badge, continue point
6. computeReleaseStatus() → theatrical / digital / upcoming
7. VerdictEngine → quality, rating, popularity recommendations
8. Return EnrichedMovieDetails
```

## Public API

Other modules should only import from `public/index.ts`:

```typescript
import {
  // Repository tokens
  MEDIA_REPOSITORY,
  MOVIE_REPOSITORY,
  SHOW_REPOSITORY,
  GENRE_REPOSITORY,

  // Types (for scoring, sync)
  type IMediaRepository,
  type IMovieRepository,
  type IShowRepository,
  type MediaScoreDataWithTmdbId,
  type SnapshotCandidate,

  // Utilities
  generateSlug,
} from '@modules/catalog/public';
```

### Consumer Modules

| Module | Uses |
|--------|------|
| `ingestion` | `IMediaRepository` — upsert media, scoring, snapshots |
| `home` | `HERO_REPOSITORY` — hero block, watching-now |
| `stats` | `IMediaRepository` — trending sync, watchers fix |
| `catalog-policy` | Indirectly via evaluations table |

## Endpoints

### Movies

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/catalog/movies/trending` | Trending movies (freshness + quality gate) |
| `GET` | `/catalog/movies/popular` | Popular movies (classics, no freshness gate) |
| `GET` | `/catalog/movies/now-playing` | Currently in theaters |
| `GET` | `/catalog/movies/new-releases` | Recent theatrical releases (`daysBack` param) |
| `GET` | `/catalog/movies/new-on-digital` | Recent digital releases (`daysBack` param) |
| `GET` | `/catalog/movies/:slug` | Full movie details with verdict |

### Shows

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/catalog/shows/trending` | Trending shows |
| `GET` | `/catalog/shows/popular` | Popular shows (classics) |
| `GET` | `/catalog/shows/new-episodes` | Shows with recent episodes (`days`, `limit`) |
| `GET` | `/catalog/shows/calendar` | Episode calendar (`startDate`, `days`) |
| `GET` | `/catalog/shows/:slug` | Full show details with seasons |

### Search & Import

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/catalog/search` | Hybrid search (`query` param) |
| `POST` | `/catalog/import/movie/:tmdbId` | Import movie from TMDB (202 Accepted) |
| `POST` | `/catalog/import/show/:tmdbId` | Import show from TMDB (202 Accepted) |
| `GET` | `/catalog/import/status/:jobId` | Poll import job status |

### Providers

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/catalog/providers` | Available streaming providers |

### Common Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Results per page (default: 20, max: 50) |
| `offset` | number | Pagination offset |
| `genres` | string | Comma-separated genre IDs |
| `sort` | enum | `trending` \| `popularity` \| `ratingo` \| `releaseDate` \| `tmdbPopularity` |
| `order` | enum | `asc` \| `desc` |
| `minRatingo` | number | Minimum Ratingo Score filter |
| `year` | number | Exact release year |
| `yearFrom` | number | Release year range start |
| `yearTo` | number | Release year range end |
| `voteSource` | enum | `tmdb` \| `trakt` (for `minVotes`) |
| `daysBack` | number | Time window (new releases/digital only) |

All list endpoints support `OptionalJwtAuthGuard` — authenticated users get enriched responses with personal state (ratings, watchlist).

## Testing

```bash
# Run all catalog tests
npm test -- src/modules/catalog

# Run specific layer
npm test -- src/modules/catalog/domain
npm test -- src/modules/catalog/application
npm test -- src/modules/catalog/infrastructure
npm test -- src/modules/catalog/presentation
```

### Test Coverage

| Layer | Test Files | Focus |
|-------|-----------|-------|
| Domain | `slug.utils.spec.ts`, `catalog-query.constants.spec.ts` | Pure functions, property-based tests |
| Application | `*-service.spec.ts` (5 files) | Service orchestration, edge cases |
| Infrastructure | `*-repository.spec.ts`, `*-query.spec.ts`, `*-mapper.spec.ts` | SQL correctness, mapping, error handling |
| Presentation | `*-controller.spec.ts`, `*-filter.spec.ts`, `*-utils.spec.ts` | HTTP integration, validation, pagination |

### Key Test Patterns

- **Property-based tests** — Slug generation edge cases (fast-check)
- **Degraded state tests** — Missing evaluations → graceful fallback
- **Race condition tests** — Concurrent imports, slug collisions
- **Batch operation tests** — Cursor pagination, stats preservation

## Integration Points

### With Other Modules

| Module | Direction | Integration |
|--------|-----------|-------------|
| `tmdb` | catalog → tmdb | `TmdbMetadataAdapter` wraps `TmdbAdapter` for search/import |
| `ingestion` | ingestion → catalog | Uses `IMediaRepository` for upsert, scoring, sync |
| `home` | home → catalog | Uses `HeroRepositoryAdapter` for homepage blocks |
| `stats` | stats → catalog | Uses `IMediaRepository` for trending sync |
| `catalog-policy` | catalog ← policy | Evaluations filter trending/popular queries |
| `user-media` | catalog → user-media | `UserStateAdapter` fetches personal state |
| `shared/cards` | catalog → cards | Card metadata (badges, continue points) |
| `shared/verdict` | catalog → verdict | Quality/popularity recommendations |

## Constraints

- **Domain purity** — Zero Nest/Drizzle imports in `domain/` layer
- **Module boundary** — External access only via `public/index.ts`
- **Pagination cap** — Max 50 items per request (CatalogListQueryDto)
- **Slug uniqueness** — `UNIQUE(type, slug)` constraint with automatic collision handling
- **Evaluation dependency** — Trending/popular queries require catalog-policy evaluations; degraded state returned if missing
- **Idempotent imports** — Duplicate import requests deduplicated at memory, queue, and DB levels
