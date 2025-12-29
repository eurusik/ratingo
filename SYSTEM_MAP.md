# SYSTEM_MAP — Ratingo System Architecture

> Constitution for agents and developers. Any new entity MUST be added here before merge.
> See `apps/api/src/ARCHITECTURE.md` for detailed runtime flows.

---

## 🏗️ Monorepo Structure

```
ratingo/
├── apps/
│   ├── api/           # NestJS backend (Fastify, Drizzle, BullMQ)
│   └── web-client/    # Next.js frontend (React, TanStack Query)
├── packages/
│   └── api-contract/  # Shared OpenAPI types (generated from backend)
└── .kiro/specs/       # Feature specifications
```

---

## 🎯 Three Boxes

| Box | What it is | Where it lives |
|-----|------------|----------------|
| **DATA** | What we know about content | DB tables, JSONB fields |
| **NORMALIZATION** | How we name things consistently | Mappers, classifiers, constants |
| **ENGINE** | How we make decisions | Policy engine, score calculator, verdict |

---

## 📊 1. DATA — Database Tables (Drizzle ORM)

### Core Catalog
| Table | Purpose | Key Fields |
|-------|---------|------------|
| `media_items` | Base movie/show info | tmdb_id, imdb_id, title, slug, ratings, watch_providers (JSONB), content_class |
| `media_stats` | Fast-changing stats | watchers_count, ratingo_score, quality_score, popularity_score, freshness_score |
| `movies` | Movie details | runtime, budget, theatrical_release_date, digital_release_date, is_now_playing |
| `shows` | Show details | total_seasons, total_episodes, status, next_air_date, drop_off_analysis (JSONB) |
| `seasons` | Season info | show_id, number, name, episode_count |
| `episodes` | Episode info | season_id, show_id, number, title, air_date, vote_average |
| `genres` | Genre taxonomy | tmdb_id, name, slug |
| `media_genres` | M2M relation | media_item_id, genre_id |

### User Domain
| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | Accounts | email, username, privacy settings (is_profile_public, show_watch_history, etc.) |
| `user_media_state` | Watch state & ratings | user_id, media_item_id, state, rating (0-100), progress (JSONB), notes |
| `user_media_actions` | Action event log | user_id, media_item_id, action, context, reason_key, payload (JSONB) |
| `user_saved_items` | Saved items projection | user_id, media_item_id, list (for_later/considering), reason_key |
| `user_subscriptions` | Notifications | user_id, media_item_id, trigger, channel, is_active |
| `refresh_tokens` | JWT refresh tokens | user_id, token_hash, expires_at, revoked_at |

### Policy Engine
| Table | Purpose | Key Fields |
|-------|---------|------------|
| `catalog_policies` | Versioned policy configs | version, is_active, policy (JSONB), activated_at |
| `media_catalog_evaluations` | Evaluation results | media_item_id, policy_version (composite PK), status, reasons[], relevance_score, breakout_rule_id, run_id |
| `catalog_evaluation_runs` | Run tracking | target_policy_id, status, counters (JSONB), cursor, error_sample (JSONB) |

### Analytics
| Table | Purpose | Key Fields |
|-------|---------|------------|
| `media_watchers_snapshots` | Daily watchers time-series | media_item_id, snapshot_date, total_watchers, region |

### Key Enums (DB)
| Enum | Values | Used In |
|------|--------|---------|
| `media_type` | movie, show | media_items.type |
| `content_class` | mainstream, anime, documentary, reality, kids | media_items.content_class |
| `eligibility_status` | pending, eligible, ineligible, review | media_catalog_evaluations.status |
| `ingestion_status` | importing, ready, failed | media_items.ingestion_status |
| `user_media_status` | watching, completed, planned, dropped | user_media_state.state |
| `saved_item_list` | for_later, considering | user_saved_items.list |
| `subscription_trigger` | release, new_season, new_episode, on_streaming, status_changed | user_subscriptions.trigger |
| `evaluation_run_status` | running, prepared, failed, cancelled, promoted | catalog_evaluation_runs.status |

---

## 🔄 2. NORMALIZATION — Stable Names & Classification

### Provider Mapping (`ingestion/domain/constants/provider-mapping.ts`)
```typescript
TMDB providerId (number) → canonical ID (string)
8 → 'netflix'
384, 1899 → 'hbo_max'
9, 119 → 'prime_video'
337 → 'disney_plus'
350 → 'apple_tv_plus'
531 → 'paramount_plus'
386, 387 → 'peacock'
15 → 'hulu'
283 → 'crunchyroll'
11 → 'mubi'
484 → 'megogo' (UA)
1773 → 'sweet_tv' (UA)
```
**Rule**: Whitelist approach. Unmapped providers ignored. NEVER match by name.
**Function**: `resolveCanonicalProvider(tmdbProviderId: number): CanonicalProviderId | undefined`

### Content Classification (`catalog-policy/domain/classification.service.ts`)
```typescript
classifyContent({ originCountries, originalLanguage, genreIds }) → ContentClass

Rules (priority order):
1. Animation (16) + JP origin/language → 'anime'
2. Documentary (99) → 'documentary'
3. Reality (10764) → 'reality'
4. Kids (10762) → 'kids'
5. Default → 'mainstream'
```
**Rule**: FAMILY (10751) stays mainstream — too broad.
**Validation**: `isValidContentClass(value): value is ContentClass`

### TMDB Mapper (`tmdb/mappers/tmdb.mapper.ts`)
Normalizes TMDB API responses to internal `NormalizedMedia` model.
Handles: movies, shows, seasons, episodes, credits, videos, watch providers.

### External Adapters (`ingestion/infrastructure/adapters/`)
| Adapter | Data | Key Methods |
|---------|------|-------------|
| `tmdb/` | Metadata, posters, trailers, watch providers | `getMovie()`, `getShow()`, `getTrending()`, `searchMulti()` |
| `trakt/` | Ratings, watchers, trending lists | `getMovieRatingsByTmdbId()`, `getShowRatingsByTmdbId()` |
| `omdb/` | IMDb/RT/Metacritic ratings | `getAggregatedRatings(imdbId)` |
| `tvmaze/` | Episode schedules | `getEpisodesByImdbId()` |

---

## ⚙️ 3. ENGINE — Decision Making

### A. Policy Engine (`catalog-policy/domain/policy-engine.ts`)

**Pure functions** — no side effects, fully testable.

**Three decisions:**
| Status | Meaning | When |
|--------|---------|------|
| `ELIGIBLE` | Shows in catalog | Passes all checks |
| `INELIGIBLE` | Hidden from catalog | Blocked or excluded |
| `PENDING` | Missing data | No originCountries or originalLanguage |

**Evaluation order (in `evaluateEligibility()`):**
```
1. Missing originCountries? → PENDING + MISSING_ORIGIN_COUNTRY
2. Missing originalLanguage? → PENDING + MISSING_ORIGINAL_LANGUAGE
3. Content class excluded? → check breakout (SOFT block)
4. Blocked country/language? → check breakout (HARD block)
5. Global quality gate? → INELIGIBLE + MISSING_GLOBAL_SIGNALS if fails
6. Neutral (not in allowed/blocked)? → INELIGIBLE (unless RELAXED mode)
7. Allowed? → ELIGIBLE + ALLOWED_COUNTRY + ALLOWED_LANGUAGE
```

**PolicyConfig (stored in DB as JSONB):**
```typescript
interface PolicyConfig {
  allowedCountries: string[]           // Whitelist
  blockedCountries: string[]           // Blacklist (HARD block)
  blockedCountryMode: 'ANY' | 'MAJORITY'  // ANY = any blocked → block; MAJORITY = >50% blocked
  allowedLanguages: string[]
  blockedLanguages: string[]
  excludedContentClasses: ContentClass[]  // SOFT block (breakout can override)
  breakoutRules: BreakoutRule[]
  globalRequirements?: GlobalRequirements  // Quality gate
  eligibilityMode: 'STRICT' | 'RELAXED'   // STRICT = AND; RELAXED = OR
  homepage: { minRelevanceScore: number }
}
```

**Evaluation Reasons (`evaluation.constants.ts`):**
| Reason | Status | Meaning |
|--------|--------|---------|
| `MISSING_ORIGIN_COUNTRY` | PENDING | No origin countries |
| `MISSING_ORIGINAL_LANGUAGE` | PENDING | No language |
| `BLOCKED_COUNTRY` | INELIGIBLE | From blocked country |
| `BLOCKED_LANGUAGE` | INELIGIBLE | In blocked language |
| `NEUTRAL_COUNTRY` | INELIGIBLE | Not in any country list |
| `NEUTRAL_LANGUAGE` | INELIGIBLE | Not in any language list |
| `EXCLUDED_CONTENT_CLASS` | varies | Content class excluded (check breakout) |
| `MISSING_GLOBAL_SIGNALS` | INELIGIBLE | Quality gate failed |
| `BREAKOUT_ALLOWED` | ELIGIBLE | Exception rule passed |
| `ALLOWED_COUNTRY` | ELIGIBLE | In country whitelist |
| `ALLOWED_LANGUAGE` | ELIGIBLE | In language whitelist |
| `NO_ACTIVE_POLICY` | - | No policy configured |
| `INVALID_CONTENT_CLASS` | - | Safety belt for bad data |

### B. Breakout Rules (`catalog-policy/domain/constants/breakout-rules.ts`)

Override SOFT blocks (content class, neutral). **Cannot override HARD blocks** (blocked country/language).

| Rule ID | Name | Requirements |
|---------|------|--------------|
| `ANIME_GLOBAL_HIT` | Anime Global Hit | 50k+ IMDB votes AND on Netflix/HBO/Prime/Disney/Apple |
| `ANIME_TRAKT_HIT` | Anime Trakt Hit | 10k+ Trakt votes AND 25k+ IMDB votes |

**BreakoutRule structure:**
```typescript
interface BreakoutRule {
  id: string
  name: string
  priority: number  // Lower = higher priority
  requirements: {
    minImdbVotes?: number
    minTraktVotes?: number
    minQualityScoreNormalized?: number
    requireAnyOfProviders?: string[]  // Canonical provider IDs
    requireAnyOfRatingsPresent?: ('imdb' | 'metacritic' | 'rt' | 'trakt')[]
  }
}
```

### C. Score Calculator (`shared/score-calculator/score-calculator.service.ts`)

**Ratingo Score = Popularity (40%) + Quality (40%) + Freshness (20%)**

| Component | Weight | Formula |
|-----------|--------|---------|
| Popularity | 40% | TMDB popularity (15%) + Trakt watchers (25%, log scale) |
| Quality | 40% | Weighted avg ratings (25%) + vote confidence (15%) |
| Freshness | 20% | Exponential decay from release date (floor: 0.2) |

**Rating weights for avgRating:**
| Source | Weight |
|--------|--------|
| IMDb | 35% |
| Trakt | 35% |
| Metacritic | 15% |
| Rotten Tomatoes | 15% |

**Normalization constants (`config/score.config.ts`):**
- `tmdbPopularityMax`: 1000
- `traktWatchersMax`: 5000
- `voteConfidenceK`: 1000 (votes for full confidence)
- `freshnessDecayDays`: 180 (half-life)
- `freshnessMinFloor`: 0.2 (classics don't fall to zero)

**Penalties:**
- < 30 votes → score × 0.7 ("new junk" protection)

**Output:**
```typescript
interface ScoreOutput {
  ratingoScore: number    // 0-100, main composite
  qualityScore: number    // 0-100
  popularityScore: number // 0-100
  freshnessScore: number  // 0-100
  avgRating: number       // 0-10, pure weighted average
  totalVotes: number
}
```

### D. Verdict Engine (`shared/verdict/`)

Generates user-facing recommendations based on ratings + popularity.
DNA: "honesty before hype"

**Rating Thresholds (`verdict.constants.ts`):**
| Threshold | Value | Verdict |
|-----------|-------|---------|
| POOR | < 5.5 | poorRatings (warning) |
| BELOW_AVERAGE | < 6.0 | belowAverage (warning) |
| MIXED | < 6.5 | mixedReviews |
| DECENT | ≥ 6.5 | decentRatings |
| STRONG | ≥ 7.0 | strongRatings |
| CRITICS_LOVED | ≥ 7.5 + 1k votes | criticsLoved |

**Confidence gates:**
- `MIN_VOTES_FOR_CONFIDENCE`: 200 (for reliable verdict)
- `MIN_VOTES_FOR_CRITICS_LOVED`: 1000
- `MIN_VOTES_FOR_SPREAD_MATTERS`: 1000

**Spread threshold:** `MAX_FOR_OPTIMISTIC`: 1.0 (max rating disagreement for optimistic verdicts)

**Age thresholds:**
- `OLDER_CONTENT_YEARS`: 3 (no hype language)
- `CLASSIC_YEARS`: 10

**Verdict types:** `warning`, `release`, `quality`, `popularity`, `general`

**Hint keys (CTA suggestions):** `newEpisodes`, `afterAllEpisodes`, `whenOnStreaming`, `notifyNewEpisode`, `general`, `forLater`, `notifyRelease`, `decideToWatch`

### E. Drop-Off Analyzer (`shared/drop-off-analyzer/`)

Analyzes show engagement patterns to detect where viewers stop watching.
Stored in `shows.drop_off_analysis` JSONB.

**Output structure:**
```typescript
{
  dropOffPoint: { season: number, episode: number, title: string } | null
  dropOffPercent: number
  overallRetention: number
  seasonEngagement: Array<{
    season: number
    avgRating: number
    avgVotes: number
    engagementDrop: number
  }>
  insight: string
  insightType: 'strong_start' | 'steady' | 'drops_early' | 'drops_late'
  analyzedAt: string
  episodesAnalyzed: number
}
```

---

## 🔀 4. DATA FLOW

### Ingestion Flow
```
TMDB API → TmdbAdapter.getMovie/getShow()
         → NormalizedMedia model
         ↓
    [PARALLEL]
    ├── TVMaze → episodes (for shows)
    ├── Trakt → ratings, watchers
    └── OMDb → IMDb/RT/MC ratings
         ↓
    ScoreCalculator.calculate() → ratingo_score
         ↓
    classifyContent() → content_class
         ↓
    MediaRepository.upsert() → media_items + media_stats
         ↓
    CatalogEvaluationService.evaluateOne() → media_catalog_evaluations
```

### Policy Activation Flow (Two-Phase)
```
Phase 1: PREPARE
POST /catalog-policy/activate { policyId }
         ↓
    PolicyActivationService.preparePolicy()
         ↓
    Create run (status: RUNNING)
         ↓
    Queue RE_EVALUATE_ALL job
         ↓
    CatalogPolicyWorker dispatches EVALUATE_CATALOG_ITEM jobs
         ↓
    Each item evaluated → media_catalog_evaluations (new policy_version)
         ↓
    Run finalized (status: PREPARED)

Phase 2: PROMOTE
POST /catalog-policy/runs/:id/promote
         ↓
    Verify coverage ≥ 100%, errors = 0
         ↓
    Activate policy (is_active = true)
         ↓
    Run status: PROMOTED
```

### Search Flow
```
User query → CatalogSearchService.search()
         ↓
    [PARALLEL]
    ├── Local DB (full-text search via tsvector)
    └── TMDB API (fallback for unimported)
         ↓
    Deduplicate (local takes precedence)
         ↓
    Return { local: [], tmdb: [] }
```

---

## 📦 5. BACKEND SERVICES (`apps/api/src/modules/`)

### Ingestion Module
| Service | Purpose |
|---------|---------|
| `SyncMediaService` | Orchestrates sync from TMDB + enrichment from Trakt/OMDb/TVMaze |
| `IngestionSchedulerService` | Cron-based scheduling for sync jobs |
| `SnapshotsService` | Daily watchers snapshots for analytics |
| `TrackedSyncService` | Diff-based sync for tracked shows |

### Catalog Module
| Service | Purpose |
|---------|---------|
| `CatalogSearchService` | Hybrid search (local + TMDB fallback) |
| `CatalogImportService` | Import single item from TMDB |
| `CatalogUserstateEnricherService` | Enrich catalog items with user state |

### Catalog-Policy Module
| Service | Purpose |
|---------|---------|
| `CatalogPolicyService` | CRUD for policies |
| `CatalogEvaluationService` | Evaluate items against policy (uses PolicyEngine) |
| `PolicyActivationService` | Two-phase activation (prepare → promote) |
| `DiffService` | Compare evaluations between policy versions |
| `DryRunService` | Preview policy changes without activation |
| `RunAggregationService` | Aggregate counters for running evaluations |
| `RunFinalizeService` | Finalize completed runs |

### User-Actions Module
| Service | Purpose |
|---------|---------|
| `SavedItemsService` | Save/unsave items to for_later/considering lists |
| `SubscriptionsService` | Subscribe/unsubscribe to notifications |
| `SubscriptionTriggerService` | Trigger notifications based on events |

### User-Media Module
| Service | Purpose |
|---------|---------|
| `UserMediaService` | Watch state CRUD (watching/completed/planned/dropped) |
| `MeListsService` | User's personal lists |

### Users Module
| Service | Purpose |
|---------|---------|
| `UsersService` | User CRUD, profile management |
| `AvatarUploadService` | S3 presigned URL for avatar upload |
| `PublicUserMediaService` | Public profile data |
| `UserProfileVisibilityPolicy` | Privacy rules for profile visibility |

### Home Module
| Service | Purpose |
|---------|---------|
| `HomeService` | Hero block items for homepage |

### Insights Module
| Service | Purpose |
|---------|---------|
| `InsightsService` | Risers/fallers based on watchers snapshots |

### Stats Module
| Service | Purpose |
|---------|---------|
| Stats sync from Trakt, drop-off analysis |

### Shared Services
| Service | Purpose |
|---------|---------|
| `ScoreCalculatorService` | Ratingo Score calculation |
| `CardEnrichmentService` | Enrich cards with metadata |
| `MovieVerdictService` | Generate movie verdicts |
| `ShowVerdictService` | Generate show verdicts |
| `DropOffAnalyzerService` | Analyze show engagement |

---

## 🔧 6. BACKGROUND JOBS (BullMQ)

### Queues
| Queue | Concurrency | Purpose |
|-------|-------------|---------|
| `ingestion` | varies | Movie/show import, trending sync |
| `stats-queue` | varies | Stats sync, drop-off analysis |
| `catalog-policy-queue` | 1 | Policy evaluation (single-threaded for consistency) |

### Ingestion Jobs (`ingestion.constants.ts`)
| Job | Trigger | Purpose |
|-----|---------|---------|
| `SYNC_MOVIE` | API/scheduled | Sync single movie from TMDB |
| `SYNC_SHOW` | API/scheduled | Sync single show from TMDB |
| `SYNC_TRENDING_DISPATCHER` | Scheduled | Queue trending page jobs |
| `SYNC_TRENDING_PAGE` | Dispatcher | Sync one page of trending |
| `SYNC_TRENDING_STATS` | After trending | Sync Trakt stats for trending items |
| `SYNC_TRACKED_SHOWS` | Scheduled | Dispatcher for tracked shows |
| `SYNC_TRACKED_SHOW_BATCH` | Dispatcher | Batch sync with diff detection |
| `SYNC_SNAPSHOTS_DISPATCHER` | Scheduled | Queue snapshot jobs |
| `SYNC_SNAPSHOT_ITEM` | Dispatcher | Single item watchers snapshot |
| `SYNC_NOW_PLAYING` | Scheduled | Now playing movies |
| `SYNC_NEW_RELEASES` | Scheduled | New digital releases |
| `UPDATE_NOW_PLAYING_FLAGS` | Scheduled | Update is_now_playing flags |

### Stats Jobs (`stats.constants.ts`)
| Job | Purpose |
|-----|---------|
| `SYNC_TRENDING` | Stats update |
| `ANALYZE_DROP_OFF` | Show drop-off analysis |

### Policy Jobs (`catalog-policy.constants.ts`)
| Job | Purpose |
|-----|---------|
| `RE_EVALUATE_ALL` | Orchestrator: dispatches EVALUATE_CATALOG_ITEM jobs |
| `EVALUATE_CATALOG_ITEM` | Evaluate single item for a run |
| `WATCHDOG` | Every 60s: finalize stale runs |

### Pipelines (`ingestion/application/pipelines/`)
| Pipeline | Purpose |
|----------|---------|
| `TrendingPipeline` | Multi-page trending sync with stats |
| `SnapshotsPipeline` | Daily watchers snapshots |
| `TrackedShowsPipeline` | Diff-based tracked shows sync |
| `NowPlayingPipeline` | Now playing movies sync |
| `NewReleasesPipeline` | New digital releases sync |

---

## 🖥️ 7. FRONTEND STRUCTURE (`apps/web-client/src/`)

### App Router Pages
| Route | Purpose |
|-------|---------|
| `/` | Homepage with hero block |
| `/browse/[category]` | Browse by category (trending, new, etc.) |
| `/movies/[slug]` | Movie details |
| `/shows/[slug]` | Show details |
| `/saved` | User saved items |
| `/settings` | User settings |
| `/admin` | Admin panel |
| `/admin/policies` | Policy management |
| `/admin/runs` | Evaluation runs |
| `/import/[tmdbId]` | Import from TMDB |

### Core Infrastructure (`core/`)
| Module | Purpose |
|--------|---------|
| `api/` | Fetch wrapper, error handling |
| `auth/` | Auth context, token storage |
| `config/` | Environment, routes |
| `providers/` | React providers (Query, Auth) |
| `query/` | TanStack Query hooks & keys |
| `saved-status/` | Saved status provider |

### Feature Modules (`modules/`)
| Module | Purpose |
|--------|---------|
| `admin/` | Admin panel components |
| `auth/` | Login/register forms |
| `browse/` | Browse page components |
| `details/` | Movie/show details |
| `home/` | Homepage components |
| `saved/` | Saved items page |
| `settings/` | Settings page |

### Shared (`shared/`)
| Folder | Purpose |
|--------|---------|
| `components/` | Header, carousel |
| `constants/` | Regions |
| `hooks/` | Custom hooks |
| `i18n/` | Internationalization (uk, en) |
| `ui/` | shadcn/ui components |
| `utils/` | cn, format, seo |

### i18n
- Default locale: `uk` (Ukrainian)
- Supported: `uk`, `en`
- Translations: `shared/i18n/locales/*.json`
- Functions: `getDictionary()`, `getByPath()`, `createTranslator()`

---

## 📦 8. SHARED PACKAGE (`packages/api-contract/`)

```
api-contract/
├── openapi.json       # Generated OpenAPI spec from backend
├── src/
│   ├── api-types.ts   # Generated TypeScript types
│   ├── helpers.ts     # Type helpers
│   └── index.ts       # Exports
```

Used by web-client for type-safe API calls.

---

## 📏 9. CONSTANTS & DICTIONARIES

### Backend (`apps/api/src/`)
| What | File | Key Values |
|------|------|------------|
| Canonical providers | `ingestion/.../provider-mapping.ts` | TMDB ID → stable name |
| Content classes | `catalog-policy/.../classification.service.ts` | Genre → semantic class |
| Breakout rules | `catalog-policy/.../breakout-rules.ts` | ANIME_GLOBAL_HIT, ANIME_TRAKT_HIT |
| Evaluation reasons | `catalog-policy/.../evaluation.constants.ts` | MISSING_*, BLOCKED_*, ALLOWED_*, etc. |
| Eligibility statuses | `catalog-policy/.../evaluation.constants.ts` | pending, eligible, ineligible, review |
| Run statuses | `catalog-policy/.../evaluation.constants.ts` | running, prepared, failed, cancelled, promoted |
| Verdict thresholds | `shared/verdict/.../verdict.constants.ts` | POOR=5.5, MIXED=6.5, STRONG=7.0, etc. |
| Score weights | `config/score.config.ts` | Popularity 40%, Quality 40%, Freshness 20% |
| Global constants | `common/constants.ts` | DEFAULT_REGION='UA', limits, thresholds |
| Media types | `common/enums/media-type.enum.ts` | movie, show |
| Ingestion jobs | `ingestion/ingestion.constants.ts` | SYNC_MOVIE, SYNC_TRENDING_*, etc. |
| Policy jobs | `catalog-policy/catalog-policy.constants.ts` | RE_EVALUATE_ALL, EVALUATE_CATALOG_ITEM, WATCHDOG |
| Stats jobs | `stats/stats.constants.ts` | SYNC_TRENDING, ANALYZE_DROP_OFF |

### Frontend (`apps/web-client/src/`)
| What | File |
|------|------|
| Regions | `shared/constants/regions.ts` |
| Routes | `core/config/routes.ts` |
| Query keys | `core/query/keys.ts` |
| Translations | `shared/i18n/locales/*.json` |

### Query Keys Structure (`core/query/keys.ts`)
```typescript
queryKeys = {
  shows: { all, trending, detail, calendar }
  movies: { all, trending, nowPlaying, newReleases, detail }
  catalog: { providers }
  home: { hero }
  search: { results }
  insights: { movements }
  auth: { me }
  userMedia: { all, state, myRatings, myWatchlist }
  users: { profile, ratings }
  userActions: { savedItems: { all, status, list }, subscriptions: { all, status, list } }
  admin: { policies: { all, detail }, runs: { all, status, diff } }
}
```

---

## 🔐 10. CONFIGS (`apps/api/src/config/`)

| Config | Purpose | Key Settings |
|--------|---------|--------------|
| `auth.config.ts` | JWT & auth | secrets, bcrypt rounds, token TTL |
| `score.config.ts` | Ratingo Score | weights, normalization, penalties |
| `tmdb.config.ts` | TMDB API | API key, base URL |
| `trakt.config.ts` | Trakt API | client ID, client secret |
| `omdb.config.ts` | OMDb API | API key |
| `scheduler.config.ts` | Cron schedules | trending, snapshots, tracked shows |

---

## ✅ 11. RULES FOR AGENTS

Before adding ANY new entity:

1. **Update this file** — add 2-3 lines describing what and where
2. **Add explicit reason** — every decision must have a `reason` in logs/DB
3. **No magic fallbacks** — no name-based matching, no "smart" guessing
4. **One source of truth** — constants live in one file only
5. **Add test or log** — prove why decision was made
6. **Pure functions in domain** — no side effects, no DB calls

### Forbidden patterns:
- ❌ Matching by provider name (use `resolveCanonicalProvider(providerId)`)
- ❌ Hardcoded country/language lists in code (use PolicyConfig in DB)
- ❌ Silent failures (always log + reason)
- ❌ New enum values without DB migration
- ❌ Guessing canonical IDs (use explicit mapping)
- ❌ Magic strings for reasons (use `EvaluationReason.*` constants)
- ❌ Direct DB calls in domain layer (use repositories)
- ❌ Mutable state in pure functions

### Required patterns:
- ✅ Explicit `EvaluationReason` for every decision
- ✅ Canonical provider IDs from `PROVIDER_ID_TO_CANONICAL`
- ✅ Content class from `classifyContent()` function
- ✅ Policy config from DB, not hardcoded
- ✅ Pure functions in domain layer (no side effects)
- ✅ Types from `api-contract` package for frontend
- ✅ Property-based tests for domain logic
- ✅ Idempotent job IDs for BullMQ jobs

### Architecture rules:
- **Presentation** → Controllers, DTOs, Swagger decorators
- **Application** → Services (orchestration), Workers, Pipelines
- **Domain** → Pure interfaces, entities, constants, validation (NO Nest/Drizzle)
- **Infrastructure** → Repositories (Drizzle), Adapters (HTTP clients)

---

*Last updated: 2024-12-29*
*Version: 3.0*


---

## 🌐 12. API ENDPOINTS

### Public Endpoints
| Route | Controller | Purpose |
|-------|------------|---------|
| `GET /home/hero` | HomeController | Hero block items |
| `GET /catalog/movies` | CatalogMoviesController | Movies list (trending, now-playing, new-releases) |
| `GET /catalog/movies/:slug` | CatalogMoviesController | Movie details |
| `GET /catalog/shows` | CatalogShowsController | Shows list (trending, calendar) |
| `GET /catalog/shows/:slug` | CatalogShowsController | Show details |
| `GET /catalog/search` | CatalogSearchController | Hybrid search (local + TMDB) |
| `GET /catalog/providers` | CatalogProvidersController | Watch providers by region |
| `GET /insights/movements` | InsightsController | Risers/fallers |
| `GET /users/:username` | PublicUsersController | Public user profile |

### Auth Endpoints
| Route | Controller | Purpose |
|-------|------------|---------|
| `POST /auth/register` | AuthController | User registration |
| `POST /auth/login` | AuthController | Login (returns access + refresh tokens) |
| `POST /auth/refresh` | AuthController | Refresh access token |
| `POST /auth/logout` | AuthController | Revoke refresh token |

### Protected Endpoints (JWT required)
| Route | Controller | Purpose |
|-------|------------|---------|
| `GET /users/me` | UsersController | Current user profile |
| `PATCH /users/me` | UsersController | Update profile |
| `GET /user-media` | UserMediaController | User's watch states |
| `POST /user-media` | UserMediaController | Set watch state |
| `GET /me/lists/*` | MeListsController | User's lists (continue, activity) |
| `GET /me/saved-items` | SavedItemsController | Saved items |
| `POST /me/saved-items` | SavedItemsController | Save item |
| `DELETE /me/saved-items` | SavedItemsController | Unsave item |
| `GET /me/subscriptions` | SubscriptionsController | Subscriptions |
| `POST /me/subscriptions` | SubscriptionsController | Subscribe |
| `DELETE /me/subscriptions` | SubscriptionsController | Unsubscribe |

### Admin Endpoints
| Route | Controller | Purpose |
|-------|------------|---------|
| `GET /admin/catalog-policies` | PolicyController | List policies |
| `POST /admin/catalog-policies` | PolicyController | Create policy |
| `POST /admin/catalog-policies/:id/activate` | PolicyController | Start activation (Phase 1) |
| `GET /admin/catalog-policies/runs` | RunController | List runs |
| `GET /admin/catalog-policies/runs/:id` | RunController | Run status |
| `POST /admin/catalog-policies/runs/:id/promote` | RunController | Promote run (Phase 2) |
| `POST /admin/catalog-policies/runs/:id/cancel` | RunController | Cancel run |
| `GET /admin/catalog-policies/runs/:id/diff` | RunController | Diff between policy versions |
| `POST /admin/catalog-policies/dry-run` | DryRunController | Preview policy changes |
| `POST /admin/catalog-policies/backfill/content-class` | BackfillController | Backfill content_class |

### Service Endpoints (Internal)
| Route | Controller | Purpose |
|-------|------------|---------|
| `POST /ingestion/sync` | IngestionController | Sync single item |
| `POST /ingestion/trending` | IngestionController | Trigger trending sync |
| `POST /ingestion/snapshots` | IngestionController | Trigger snapshots |
| `GET /stats/*` | StatsController | Stats sync, drop-off analysis |

### Auth Guards
| Guard | Purpose |
|-------|---------|
| `JwtAuthGuard` | Requires valid JWT |
| `OptionalJwtAuthGuard` | JWT optional (enriches with user if present) |
| `LocalAuthGuard` | Username/password validation |

### Auth Strategies
| Strategy | Purpose |
|----------|---------|
| `JwtStrategy` | Validates JWT tokens |
| `LocalStrategy` | Validates username/password |


---

## ⚠️ 13. ERROR HANDLING

### Common Exceptions (`common/exceptions/`)
| Exception | HTTP Status | Purpose |
|-----------|-------------|---------|
| `AppException` | varies | Base exception with error code |
| `DatabaseException` | 500 | Database errors |
| `ExternalApiException` | 502/503 | External API failures |
| `NotFoundException` | 404 | Resource not found |
| `ValidationException` | 400 | Input validation errors |

### Domain Errors (`catalog-policy/domain/errors/`)
| Error | Purpose |
|-------|---------|
| `InvalidEligibilityStatusError` | Invalid status value |
| `InvalidRunStatusError` | Invalid run status |
| `InvalidBreakoutRuleError` | Invalid breakout rule config |
| `InvalidRunStateTransitionError` | Invalid state transition (e.g., cancel promoted run) |

### Error Codes (`common/enums/error-code.enum.ts`)
Used for consistent error responses across API.

### Global Exception Filter (`common/filters/all-exceptions.filter.ts`)
Catches all exceptions and formats them as:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "statusCode": 400,
    "details": { ... }
  }
}
```

---

## 🔒 14. INFRASTRUCTURE

### HTTP Client (`common/http/resilient-http.client.ts`)
- Retry with exponential backoff
- Circuit breaker pattern
- Timeout handling

### Rate Limiting
| Tier | Limit | Methods |
|------|-------|---------|
| `default` | 600 req/min | GET, HEAD, OPTIONS |
| `strict` | 120 req/min | POST, PUT, PATCH, DELETE |

Uses `ThrottlerRealIpGuard` for Cloudflare/proxy support.

### Interceptors
| Interceptor | Purpose |
|-------------|---------|
| `ResponseInterceptor` | Wraps responses in `{ success: true, data: ... }` |
| `PerformanceInterceptor` | Logs slow requests |

### Database
- **ORM**: Drizzle ORM
- **DB**: PostgreSQL 16
- **Migrations**: `apps/api/drizzle/` (26 migrations, 0000-0025)
- **Schema**: `apps/api/src/database/schema.ts`
- **Config**: `apps/api/drizzle.config.ts`
- **Commands**: `npm run db:generate`, `npm run db:migrate`

### Queues
- **BullMQ** with Redis
- Queues: `ingestion`, `stats-queue`, `catalog-policy-queue`

### File Storage
- **S3 / Cloudflare R2** for avatars
- Presigned URLs for uploads

---

*Last updated: 2024-12-29*
*Version: 3.1*


---

## 🚀 15. DEVOPS & DEPLOYMENT

### Docker
- **Dockerfile** — main app container
- **Dockerfile.cron** — cron jobs container
- **docker-compose.yml** — local dev environment:
  - `postgres-v1` (port 5433) — main DB
  - `postgres-v2` (port 5434) — secondary DB
  - `redis` (port 6379) — BullMQ queues

### CI/CD (`.github/workflows/ci-cd.yml`)
- **Trigger**: push to `main`, tags `v*`, `release-*`
- **Registry**: GitHub Container Registry (ghcr.io)
- **Platform**: linux/arm64
- **Image**: `ghcr.io/eurusik/ratingo`

### Turborepo (`turbo.json`)
Tasks: `build`, `lint`, `test`, `dev`, `db:generate`, `db:migrate`

### Husky (`.husky/`)
Git hooks: `pre-commit`, `commit-msg`, `pre-push`

### Commitlint (`commitlint.config.cjs`)
Conventional commits enforcement.

---

## 📋 16. SPECS (`.kiro/specs/`)

Feature specifications for incremental development:

| Spec | Purpose |
|------|---------|
| `admin-policy-ui/` | Admin panel for policy management |
| `admin-ui-shell/` | Admin UI shell/layout |
| `catalog-observability/` | Metrics and monitoring |
| `catalog-policy-engine/` | Core policy engine |
| `catalog-policy-refactoring/` | Policy engine refactoring |
| `content-classification/` | Content class system |
| `context-aware-eligibility/` | Context-based evaluation |
| `global-quality-gate/` | Quality gate requirements |
| `policy-activation-flow/` | Two-phase activation |
| `user-settings/` | User settings UI |

---

## 📝 17. DOCUMENTATION STANDARDS

### TSDoc (`DOCS_STANDARD.md`)
- Language: English
- Style: Imperative ("Gets user", not "This function returns...")
- Format: `@param`, `@returns`, `@throws`, `@example`

### Swagger
- DTOs use `@ApiProperty` decorators
- Controllers use `@ApiTags`, `@ApiOperation`, `@ApiResponse`

---

*Last updated: 2024-12-29*
*Version: 3.2 — FINAL*

---

## 📊 SUMMARY

| Category | Count |
|----------|-------|
| DB Tables | 14 |
| DB Enums | 8 |
| DB Migrations | 26 |
| Backend Modules | 12 |
| Backend Services | 30+ |
| API Endpoints | 40+ |
| Background Jobs | 15 |
| Pipelines | 5 |
| Frontend Pages | 10 |
| Frontend Modules | 7 |
| Configs | 6 |
| Specs | 10 |
