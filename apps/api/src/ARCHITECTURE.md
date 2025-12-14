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
├── database/               # Drizzle schema + migrations
├── common/                 # Shared utilities, filters, interceptors
└── modules/
    ├── auth/               # Authentication (JWT)
    ├── users/              # User accounts
    ├── user-media/         # User watch state
    ├── catalog/            # Movies/shows catalog
    ├── ingestion/          # Data import from external APIs
    ├── stats/              # Statistics & ratings
    ├── insights/           # Trend analytics
    ├── home/               # Homepage (hero block)
    ├── tmdb/               # TMDB adapter
    └── shared/             # Shared services (ScoreCalculator, DropOffAnalyzer)
```

---

## Module Layers

Each module has 4 layers:

```
module/
├── presentation/     # Controllers, DTOs, Swagger
├── application/      # Services (business logic)
├── domain/           # Interfaces, entities, DI tokens
└── infrastructure/   # Repositories (Drizzle), adapters (HTTP)
```

**Rule**: `domain/` has no Nest/Drizzle dependencies — pure interfaces only.

---

## Core Modules

### Auth
- JWT access/refresh tokens
- Strategies: `JwtStrategy`, `LocalStrategy`
- Guards: `JwtAuthGuard`, `OptionalJwtAuthGuard`

### Users
- Profile CRUD
- Public profiles with privacy policy
- Avatar uploads (S3 presigned URL)

### UserMedia
- Watch state: `planned`, `watching`, `completed`, `dropped`
- Ratings, notes, progress

### Catalog
- Public movies/shows catalog
- Trending, now-playing, new releases
- Search (local + TMDB)
- Episode calendar

### Ingestion
- Metadata import from TMDB
- Enrichment: TVMaze (episodes), Trakt/OMDb (ratings)
- Ratingo Score calculation
- BullMQ worker for background jobs

### Stats
- Stats sync from Trakt
- Show drop-off analysis

### Insights
- Analytics: risers/fallers by period

---

## Database (Drizzle)

Main tables:

| Table | Purpose |
|-------|---------|
| `media_items` | Base movie/show info |
| `media_stats` | Fast-changing stats (watchers, scores) |
| `movies` | Movie details |
| `shows` | Show details |
| `seasons`, `episodes` | Show structure |
| `genres` | Genres |
| `users` | Users |
| `user_media_state` | Watch state |
| `media_watchers_snapshots` | Historical snapshots for Insights |

---

## Background Jobs (BullMQ)

### Queues

| Queue | Purpose |
|-------|---------|
| `ingestion` | Movie/show import |
| `stats-queue` | Stats sync |

### Job Types

**Ingestion:**
- `SYNC_MOVIE` / `SYNC_SHOW` — single item sync
- `SYNC_TRENDING` — batch trending import
- `SYNC_NOW_PLAYING` — now playing movies
- `SYNC_SNAPSHOTS` — daily snapshots

**Stats:**
- `SYNC_TRENDING` — stats update
- `ANALYZE_DROP_OFF` — show drop-off analysis

---

## External Integrations

| Service | Data |
|---------|------|
| **TMDB** | Metadata, posters, trailers, watch providers |
| **Trakt** | Ratings, watchers, trending lists |
| **OMDb** | IMDb/Rotten Tomatoes/Metacritic ratings |
| **TVMaze** | Show episode schedule |

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
         ├──► DB: upsert NormalizedMedia
         │
         └──► DB: status = READY
```

### 2. Stats Sync

```
POST /stats/sync
         │
         ▼
    ┌─────────────┐
    │ BullMQ Job  │
    └─────────────┘
         │
         ▼
    ┌──────────────┐
    │ StatsWorker  │
    └──────────────┘
         │
         ▼
    ┌──────────────┐
    │ StatsService │
    └──────────────┘
         │
         ├──► Trakt: trending movies + shows
         │
         ├──► DB: find local media items
         │
         ├──► ScoreCalculator: recalculate scores
         │
         └──► DB: bulk upsert stats
```

### 3. Authentication

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
4. Add handler in worker

### Add a New External API

1. Create config in `src/config/`
2. Create adapter in `infrastructure/adapters/`
3. Inject into orchestration service

---

*Generated from `apps/api/src` codebase*
