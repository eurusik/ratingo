# Ratingo API — Architecture

> Runtime architecture of the NestJS API (`apps/api/src`).

---

## Tech Stack

| Category      | Technology                |
| ------------- | ------------------------- |
| Framework     | NestJS + Fastify          |
| Database      | PostgreSQL + Drizzle ORM  |
| Queues        | BullMQ (Redis)            |
| External APIs | TMDB, Trakt, OMDb, TVMaze |
| File Storage  | S3 / Cloudflare R2        |
| Docs          | Swagger (`/docs`)         |

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
    ├── job-failures/       # Daily summary of failed BullMQ jobs with a classified reason
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
- Episode merge (`domain/episode-pairing.ts`, `episode-sync-merge.ts`, `episode-backfill-plan.ts`): TVMaze leads for episodes it knows, TMDB fills per field (Ukrainian title and overview win; still, runtime, rating fill only gaps; a date-only TMDB air date fills an undated episode only two days after it passed). Episodes pair by number when both sources count the season the same and their air dates are within 2 days, otherwise only by unique English title. An undated season takes the date of its first episode. `BackfillEpisodeDetailsPipeline` applies the same rule to stored episodes every Sunday and skips shows checked in the last 28 days (`shows.episode_details_checked_at`); `RepairEpisodeTitlesPipeline` is a one-off that re-pairs renumbered seasons through TVMaze titles
- TVMaze reliability: `TvMazeAdapter` returns no episodes only for a 404 and throws `EpisodeScheduleUnavailableError` for 429, 5xx, network errors and empty bodies (401/403/429 also emit `external-api.failure` for provider `tvmaze`); it starts at most 18 requests per 10 s. When TVMaze is unavailable the sync drops seasons, `totalEpisodes`, `lastAirDate` and `nextAirDate` from the payload (`domain/stored-episode-schedule.ts`), so stored episodes and show dates stay as they are and no TMDB fallback runs; scoring uses the stored `lastAirDate`
- Date-only air dates: TMDB episode dates are stored at 12:00 UTC of their calendar day (`middayUtcOfCalendarDate`), which is the same day from UTC-11 to UTC+11, Kyiv included, and marked `episodes.air_date_day_only = true`; TVMaze airstamps are marked `false`, legacy rows are `null`. The episode upsert keeps a stored exact instant (`false`) when a day-only date for the same airing (within 2 days) arrives. The calendar returns this as `airDateDayOnly` (legacy `null` reads as `false`), and the storefront then shows only the day
- Season size: a TVMaze-enriched season stores `seasons.episode_count` from `seasonEpisodeCount` (`ingestion/domain/season-episode-count.ts`): for the latest TVMaze season of a show that is not Ended or Canceled it is the larger of TVMaze's listed episodes and TMDB's `episode_count`, because TVMaze often lists only the first part of a running season; every other season takes TVMaze's list, so an overcounted TMDB size can still shrink. `shows.total_episodes` is the sum of these season sizes. TMDB's `episode_count` of 0 means unknown and is not written
- Next season: a TVMaze season TMDB does not list is kept when it is the one right after TMDB's last season, has a dated episode, and TMDB does not mark the show `Ended` or `Canceled` (`domain/next-season-announcement.ts`); it is saved without TMDB season metadata, which the season upsert fills once TMDB lists it
- Ratingo Score calculation
- **Pipelines**: TrendingPipeline, SnapshotsPipeline, TrackedShowsPipeline, NowPlayingPipeline, NewReleasesPipeline, UpcomingMoviesPipeline, AnticipatedShowsPipeline
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

| Table                    | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `media_items`            | Base movie/show info with full-text search          |
| `media_stats`            | Fast-changing stats (watchers, Ratingo Score)       |
| `movies`                 | Movie details (runtime, budget, releases)           |
| `shows`                  | Show details (seasons, episodes, drop-off analysis) |
| `seasons`, `episodes`    | Show structure                                      |
| `genres`, `media_genres` | Genre taxonomy                                      |

### User Tables

| Table                | Purpose                             |
| -------------------- | ----------------------------------- |
| `users`              | User accounts with privacy settings |
| `user_media_state`   | Watch state & ratings               |
| `user_media_actions` | Action event log                    |
| `user_saved_items`   | Saved items projection              |
| `user_subscriptions` | Notification subscriptions          |
| `refresh_tokens`     | JWT refresh token storage           |

### Catalog Policy Tables

| Table                       | Purpose                               |
| --------------------------- | ------------------------------------- |
| `catalog_policies`          | Versioned policy configurations       |
| `media_catalog_evaluations` | Evaluation results per media item     |
| `catalog_evaluation_runs`   | Run tracking for prepare/promote flow |

### Analytics Tables

| Table                      | Purpose                    |
| -------------------------- | -------------------------- |
| `media_watchers_snapshots` | Daily watchers time-series |

### Operations Tables

| Table              | Purpose                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `job_failure_days` | Failed BullMQ jobs per Kyiv day, queue, job type, scheduler, class |

`job_failure_days` (module `job-failures`) has one row per Kyiv day, queue, job type, scheduler job id (null for jobs not started by a scheduler; the unique key is `NULLS NOT DISTINCT`) and error class. It holds `failure_count` (every failed attempt), `exhausted_count` (attempts that will not be retried), `first_failed_at`, `last_failed_at` and `last_message` (the newest message, at most 300 characters, with URL query strings, credentials, tokens, long hex keys, mixed-case secrets, e-mails and query parameters removed; UUIDs and ordinary ids are kept).

- **Write path.** `QueueJobMetricsService` (worker processes only, `APP_ROLE` `worker` or `all`) hands every `failed` event to `JobFailureRecorder`. The recorder classifies the error, redacts the message and adds the failure to an in-memory tally per row key, so a storm of failures on one row costs one write. Every 5 seconds, and once more in `onApplicationShutdown` (with a 3-second limit; in the `worker.ts` entrypoint this runs after the BullMQ workers have drained and before the pool closes, while the `main.ts` entrypoint has no shutdown hooks, so with `APP_ROLE=all` the last few seconds can be lost on restart), it writes all pending tallies in one multi-row upsert that adds them in SQL (`failure_count = failure_count + excluded.failure_count`). At most 500 distinct rows wait for one flush; failures for further rows are dropped and counted in a warning. Only one flush runs at a time. `record` never throws, and a failed write is logged with its reason and never reaches the worker.
- **Classes.** `rate_limit`, `access_denied`, `not_found`, `timeout`, `network`, `database`, `other` (`classifyJobFailure`): the error type decides first (database and abort errors), then the upstream HTTP status (`ExternalApiException.upstreamStatus`, `HttpError.status`), then a Node or SQLSTATE error code, and only then the message. Stored as text with a `CHECK` constraint, not a Postgres enum.
- **Retention.** `JOB_FAILURE_RETENTION_DAYS` (14) Kyiv days, today included. After a successful flush, at most once a day per process, the recorder deletes `day < kyiv_today - 13`, which is the same window the view shows; a spec ties the view's `- 13` to the constant. With no failures nothing is written, so the table does not grow.
- **Reporting.** `reporting.daily_job_failures` returns the last 14 Kyiv days to `ai_reader`; Veronica's `job_failures` tool reads it.

---

## Background Jobs (BullMQ)

### Queues

| Queue                  | Purpose                          |
| ---------------------- | -------------------------------- |
| `ingestion`            | Movie/show import, trending sync |
| `stats-queue`          | Stats sync, drop-off analysis    |
| `catalog-policy-queue` | Policy evaluation, re-evaluation |

### Ingestion Jobs

| Job                         | Purpose                         |
| --------------------------- | ------------------------------- |
| `SYNC_MOVIE` / `SYNC_SHOW`  | Single item sync                |
| `SYNC_TRENDING_DISPATCHER`  | Queue trending page jobs        |
| `SYNC_TRENDING_PAGE`        | Sync one page of trending       |
| `SYNC_TRENDING_STATS`       | Sync Trakt stats after trending |
| `SYNC_NOW_PLAYING`          | Now playing movies              |
| `SYNC_NEW_RELEASES`         | New digital releases            |
| `SYNC_TRACKED_SHOWS`        | Dispatcher for tracked shows    |
| `SYNC_TRACKED_SHOW_BATCH`   | Batch sync with diff detection  |
| `SYNC_SNAPSHOTS_DISPATCHER` | Batch-sync daily snapshots      |

### Stats Jobs

| Job                | Purpose                |
| ------------------ | ---------------------- |
| `SYNC_TRENDING`    | Stats update           |
| `ANALYZE_DROP_OFF` | Show drop-off analysis |

### Catalog Policy Jobs

| Job                     | Purpose                    |
| ----------------------- | -------------------------- |
| `RE_EVALUATE_ALL`       | Re-evaluate entire catalog |
| `EVALUATE_CATALOG_ITEM` | Evaluate single item       |
| `WATCHDOG`              | Monitor stuck runs         |

---

## External Integrations

| Service    | Data                                         |
| ---------- | -------------------------------------------- |
| **TMDB**   | Metadata, posters, trailers, watch providers |
| **Trakt**  | Ratings, watchers, trending lists            |
| **OMDb**   | IMDb/Rotten Tomatoes/Metacritic ratings      |
| **TVMaze** | Show episode schedule                        |

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
         ├──► [if show] TVMaze: episodes (unavailable → keep stored episodes, skip TMDB episodes)
         │
         ├──► [if show] TMDB: episodes TVMaze lacks, fields TVMaze lacks
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

| Tier      | Limit                   | Methods                  | Purpose        |
| --------- | ----------------------- | ------------------------ | -------------- |
| `default` | 600 req/min             | GET, HEAD, OPTIONS       | Browsing       |
| `strict`  | 120 req/min             | POST, PUT, PATCH, DELETE | Mutations      |
| `auth`    | Applied via @Throttle() | Auth routes              | Login/register |

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

### System catalogs (Veronica's system card)

Three catalogs describe what the API runs, one line of plain language per entry:

- `telemetry/scheduled-jobs.catalog.ts` — `SCHEDULED_JOBS`: every scheduled job (the ingestion jobs from `scheduler.config.ts`, each with a required `description`, plus the key-health, movie-release-notification and link-pending-imports schedulers); the scheduler metrics take their job names from it
- `telemetry/monitored-queues.catalog.ts` — `MONITORED_QUEUES`: the queues the queue metrics report
- `config/external-providers.catalog.ts` — `EXTERNAL_PROVIDERS`: the external APIs, by their default base URL

`npm run system-card:update` writes them to `apps/ai/veronica/src/modules/chat/domain/constants/system-card.json`; `scripts/system-card/system-card.builder.spec.ts` fails while that file is stale. A new scheduled job, queue or provider gets its catalog entry and a fresh card in the same change.

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

_Last updated: December 2024_
