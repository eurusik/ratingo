# Ratingo API — Architecture

> Runtime architecture of the NestJS API (`apps/api/src`).

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | NestJS + Fastify |
| Database | PostgreSQL + Drizzle ORM |
| Queues | BullMQ (Redis) |
| External APIs | TMDB, Trakt, OMDb, TVMaze |
| File Storage | S3 / Cloudflare R2 |
| Docs | Swagger (`/docs`) |

---

## Project Structure

```
apps/api/src/
├── main.ts                 # Entry point
├── app.module.ts           # Root module
├── config/                 # Environment configs
│   ├── auth.config.ts      # JWT & bcrypt settings
│   ├── omdb.config.ts      # OMDb API config
│   ├── scheduler.config.ts # Cron scheduler config
│   ├── score.config.ts     # Ratingo Score weights
│   ├── tmdb.config.ts      # TMDB API config
│   └── trakt.config.ts     # Trakt API config
├── database/               # Drizzle schema + migrations
├── common/                 # Shared utilities
│   ├── enums/              # Error codes, media types, statuses
│   ├── exceptions/         # Custom exceptions (App, Database, Validation, NotFound)
│   ├── filters/            # Global exception filter
│   ├── guards/             # ThrottlerRealIpGuard (Cloudflare support)
│   ├── http/               # ResilientHttpClient (retry, circuit breaker)
│   ├── interceptors/       # Response & Performance interceptors
│   ├── interfaces/         # API response interface
│   └── utils/              # Date & media utilities
├── scripts/                # CLI scripts (OpenAPI generation)
└── modules/
    ├── auth/               # Authentication (JWT)
    ├── users/              # User accounts & profiles
    ├── user-media/         # User watch state & ratings
    ├── user-actions/       # Saved items, subscriptions, action log
    ├── catalog/            # Movies/shows catalog
    ├── catalog-policy/     # Catalog eligibility engine
    ├── ingestion/          # Data import from external APIs
    ├── stats/              # Statistics & ratings sync
    ├── insights/           # Trend analytics (risers/fallers)
    ├── home/               # Homepage (hero block)
    ├── tmdb/               # TMDB adapter
    └── shared/             # Shared services
        ├── cards/          # Card rendering service
        ├── drop-off-analyzer/  # Show drop-off analysis
        ├── score-calculator/   # Ratingo Score calculation
        └── verdict/        # Media verdict generation
```

---

## Module Layers

Each module follows Clean Architecture with 4 layers:

```
module/
├── presentation/     # Controllers, DTOs, Swagger decorators
├── application/      # Services (business logic), workers, pipelines
├── domain/           # Interfaces, entities, DI tokens, validation
└── infrastructure/   # Repositories (Drizzle), adapters (HTTP clients)
```

**Rule**: `domain/` has no Nest/Drizzle dependencies — pure interfaces only.

---

## Core Modules

### Auth
- JWT access/refresh tokens with rotation
- Strategies: `JwtStrategy`, `LocalStrategy`
- Guards: `JwtAuthGuard`, `OptionalJwtAuthGuard`
- Token storage in `refresh_tokens` table

### Users
- Profile CRUD with privacy settings
- Public profiles with configurable visibility
- Avatar uploads (S3 presigned URL)
- Settings: `isProfilePublic`, `showWatchHistory`, `showRatings`, `allowFollowers`

### UserMedia
- Watch state: `planned`, `watching`, `completed`, `dropped`
- Ratings (0-100 scale), notes, progress tracking
- Stored in `user_media_state` table

### UserActions
- **Saved Items**: `for_later`, `considering` lists with reason tracking
- **Subscriptions**: Notifications for `release`, `new_season`, `new_episode`, `on_streaming`, `status_changed`
- **Action Log**: Event sourcing for all user interactions (`user_media_actions`)

### Catalog
- Public movies/shows catalog
- Trending, now-playing, new releases
- Search (local full-text + TMDB fallback)
- Episode calendar
- Watch providers by region

### CatalogPolicy
- **Policy Engine**: Versioned eligibility rules for catalog filtering
- **Evaluation**: Country/language filtering, breakout rules, relevance scoring
- **Activation Flow**: Prepare → Dry Run → Promote workflow
- **Services**: DiffService, DryRunService, RunAggregationService, RunFinalizeService
- **Background Jobs**: RE_EVALUATE_ALL, EVALUATE_CATALOG_ITEM, WATCHDOG

### Ingestion
- Metadata import from TMDB
- Enrichment: TVMaze (episodes), Trakt/OMDb (ratings)
- Ratingo Score calculation
- **Pipelines**: TrendingPipeline, SnapshotsPipeline, TrackedShowsPipeline, NowPlayingPipeline, NewReleasesPipeline
- BullMQ worker for background jobs

### Stats
- Stats sync from Trakt
- Show drop-off analysis
- Watchers snapshots for trend analysis

### Insights
- Analytics: risers/fallers by period
- Based on `media_watchers_snapshots` time-series data

### Shared Services
- **ScoreCalculator**: Ratingo Score (quality + popularity + freshness)
- **DropOffAnalyzer**: Show engagement analysis
- **Verdict**: Media verdict generation for UI
- **Cards**: Card rendering service

---

## Database (Drizzle)

### Core Tables

| Table | Purpose |
|-------|---------|
| `media_items` | Base movie/show info with full-text search |
| `media_stats` | Fast-changing stats (watchers, Ratingo Score) |
| `movies` | Movie details (runtime, budget, releases) |
| `shows` | Show details (seasons, episodes, drop-off analysis) |
| `seasons`, `episodes` | Show structure |
| `genres`, `media_genres` | Genre taxonomy |

### User Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts with privacy settings |
| `user_media_state` | Watch state & ratings |
| `user_media_actions` | Action event log |
| `user_saved_items` | Saved items projection |
| `user_subscriptions` | Notification subscriptions |
| `refresh_tokens` | JWT refresh token storage |

### Catalog Policy Tables

| Table | Purpose |
|-------|---------|
| `catalog_policies` | Versioned policy configurations |
| `media_catalog_evaluations` | Evaluation results per media item |
| `catalog_evaluation_runs` | Run tracking for prepare/promote flow |

### Analytics Tables

| Table | Purpose |
|-------|---------|
| `media_watchers_snapshots` | Daily watchers time-series |

---

## Background Jobs (BullMQ)

### Queues

| Queue | Purpose |
|-------|---------|
| `ingestion` | Movie/show import, trending sync |
| `stats-queue` | Stats sync, drop-off analysis |
| `catalog-policy-queue` | Policy evaluation, re-evaluation |

### Ingestion Jobs

| Job | Purpose |
|-----|---------|
| `SYNC_MOVIE` / `SYNC_SHOW` | Single item sync |
| `SYNC_TRENDING_DISPATCHER` | Queue trending page jobs |
| `SYNC_TRENDING_PAGE` | Sync one page of trending |
| `SYNC_TRENDING_STATS` | Sync Trakt stats after trending |
| `SYNC_NOW_PLAYING` | Now playing movies |
| `SYNC_NEW_RELEASES` | New digital releases |
| `SYNC_TRACKED_SHOWS` | Dispatcher for tracked shows |
| `SYNC_TRACKED_SHOW_BATCH` | Batch sync with diff detection |
| `SYNC_SNAPSHOTS_DISPATCHER` | Queue snapshot jobs |
| `SYNC_SNAPSHOT_ITEM` | Single item snapshot |

### Stats Jobs

| Job | Purpose |
|-----|---------|
| `SYNC_TRENDING` | Stats update |
| `ANALYZE_DROP_OFF` | Show drop-off analysis |

### Catalog Policy Jobs

| Job | Purpose |
|-----|---------|
| `RE_EVALUATE_ALL` | Re-evaluate entire catalog |
| `EVALUATE_CATALOG_ITEM` | Evaluate single item |
| `WATCHDOG` | Monitor stuck runs |

---

## External Integrations

| Service | Data |
|---------|------|
| **TMDB** | Metadata, posters, trailers, watch providers |
| **Trakt** | Ratings, watchers, trending lists |
| **OMDb** | IMDb/Rotten Tomatoes/Metacritic ratings |
| **TVMaze** | Show episode schedule |

### Adapters

```
infrastructure/adapters/
├── omdb/           # OmdbAdapter
├── trakt/          # TraktRatingsAdapter, TraktListsAdapter
└── tvmaze/         # TvMazeAdapter
```

---

## Runtime Flows

### 1. Movie/Show Import

```
POST /ingestion/sync { tmdbId, type }
         │
         ▼
    ┌─────────────┐
    │ BullMQ Job  │
    └─────────────┘
         │
         ▼
    ┌─────────────┐
    │ SyncWorker  │
    └─────────────┘
         │
         ▼
    ┌──────────────────┐
    │ SyncMediaService │
    └──────────────────┘
         │
         ├──► DB: status = IMPORTING
         │
         ├──► TMDB: fetch metadata
         │
         ├──► [if show] TVMaze: episodes
         │
         ├──► Trakt + OMDb: ratings (parallel)
         │
         ├──► ScoreCalculator: calculate Ratingo Score
         │
         ├──► CatalogEvaluationService: evaluate eligibility
         │
         ├──► DB: upsert NormalizedMedia
         │
         └──► DB: status = READY
```

### 2. Trending Sync (Pipeline)

```
POST /ingestion/trending
         │
         ▼
    ┌───────────────────────┐
    │ SYNC_TRENDING_DISPATCHER │
    └───────────────────────┘
         │
         ├──► Queue SYNC_TRENDING_PAGE jobs (pages 1-N)
         │
         ▼
    ┌───────────────────┐
    │ SYNC_TRENDING_PAGE │ (parallel)
    └───────────────────┘
         │
         ├──► TMDB: fetch trending page
         │
         ├──► Upsert media items
         │
         └──► On last page: queue SYNC_TRENDING_STATS
                    │
                    ▼
              ┌──────────────────┐
              │ SYNC_TRENDING_STATS │
              └──────────────────┘
                    │
                    └──► Trakt: sync stats for all trending items
```

### 3. Policy Activation Flow

```
POST /catalog-policy/activate { policyId }
         │
         ▼
    ┌─────────────────────┐
    │ PolicyActivationService │
    └─────────────────────┘
         │
         ├──► Create evaluation run (status: running)
         │
         ├──► Queue RE_EVALUATE_ALL job
         │
         ▼
    ┌─────────────────────┐
    │ CatalogPolicyWorker │
    └─────────────────────┘
         │
         ├──► Iterate all READY media items
         │
         ├──► PolicyEngine.evaluate() for each
         │
         ├──► Store evaluations with new policy version
         │
         └──► Run status: prepared
                    │
                    ▼
         GET /catalog-policy/runs/:id/diff
                    │
                    └──► DiffService: compare old vs new evaluations
                              │
                              ▼
                    POST /catalog-policy/runs/:id/promote
                              │
                              └──► Activate policy, update public view
```

### 4. Authentication

```
POST /auth/login { email, password }
         │
         ▼
    ┌─────────────┐
    │ AuthService │
    └─────────────┘
         │
         ├──► UsersService: find user
         │
         ├──► PasswordHasher: verify password
         │
         └──► Return { accessToken, refreshToken }


POST /auth/refresh { refreshToken }
         │
         ▼
    ┌─────────────┐
    │ AuthService │
    └─────────────┘
         │
         ├──► Verify refresh token
         │
         ├──► Revoke old token
         │
         └──► Issue new token pair
```

---

## Rate Limiting

Global rate limiting with tiered protection:

| Tier | Limit | Methods | Purpose |
|------|-------|---------|---------|
| `default` | 600 req/min | GET, HEAD, OPTIONS | Browsing |
| `strict` | 120 req/min | POST, PUT, PATCH, DELETE | Mutations |
| `auth` | Applied via @Throttle() | Auth routes | Login/register |

Uses `ThrottlerRealIpGuard` for Cloudflare/proxy support.

---

## API Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "statusCode": 400,
    "details": { ... }
  }
}
```

---

## Conventions

- **Controllers** — HTTP routing only, delegate logic to services
- **Services** — business logic, orchestration
- **Repositories** — DB access via Drizzle
- **Adapters** — HTTP clients for external APIs
- **Pipelines** — Multi-step background job orchestration
- **Domain** — pure interfaces, no framework dependencies

---

## How to Extend

### Add a New Module

1. Create folder `src/modules/<name>/` with subfolders:
   - `presentation/`, `application/`, `domain/`, `infrastructure/`
2. Define interfaces in `domain/repositories/`
3. Implement repositories in `infrastructure/`
4. Add module to `AppModule`

### Add a New Background Job

1. Add job type to `*.constants.ts`
2. Register queue via `BullModule.registerQueue()`
3. Add producer (controller/service) with `@InjectQueue()`
4. Add handler in worker or create a pipeline class

### Add a New External API

1. Create config in `src/config/`
2. Create adapter in `infrastructure/adapters/`
3. Inject into orchestration service

### Add a New Pipeline

1. Create pipeline class in `application/pipelines/`
2. Define dispatcher job (queues child jobs)
3. Define item/page jobs (process chunks)
4. Register in module providers

---

*Last updated: December 2024*
