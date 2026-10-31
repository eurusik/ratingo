// Moved to shared/contracts (ADR 0001 Phase 1); re-exported for existing
// ingestion imports. New code outside ingestion should import shared/contracts.
export {
  INGESTION_QUEUE,
  BACKFILL_QUEUE,
  RATINGS_BACKFILL_QUEUE,
  DEFAULT_INGESTION_JOB_OPTIONS,
  IngestionJob,
} from '../shared/contracts';

/**
 * Chunk size for tracked shows batch processing.
 */
export const TRACKED_SHOWS_CHUNK_SIZE = 50;

/**
 * Delay between TMDB API calls in milliseconds.
 * TMDB allows ~40 req/s; a 300ms delay (~3.3 req/s) stays well within it.
 */
export const TMDB_REQUEST_DELAY_MS = 300;

/**
 * Batch size for snapshot dispatcher pagination.
 */
export const SNAPSHOTS_BATCH_SIZE = 500;

/**
 * Hard cap on items the snapshots dispatcher may process per run.
 *
 * Prevents the dispatcher from running for many hours on a fresh or grown
 * catalog. With Trakt rate limit ~30/min, 5000 items ≈ 3h per run. The cursor
 * only lives within a single run (it does NOT persist to the next one); progress
 * across runs of the same UTC day comes from the candidate query excluding items
 * that already have today's snapshot. A new day starts over from the lowest id, so
 * the dispatcher must be scheduled more than once per day for catalogs above the cap.
 *
 * Without this cap, a single run could hold the ingestion worker for 24h+
 * on catalogs of 50k+ ELIGIBLE items, preventing any other ingestion jobs
 * from executing in that time window.
 */
export const SNAPSHOTS_RUN_CAP = 5_000;

/**
 * Bulk limit for tracked shows job enqueueing.
 */
export const TRACKED_SHOWS_BULK_LIMIT = 10;

/**
 * Delay before trending stats sync job (in milliseconds).
 * Allows time for page jobs to complete before stats aggregation.
 * 3 minutes = 180000ms
 */
export const TRENDING_STATS_DELAY_MS = 180000;

/**
 * Default number of pages to sync for trending.
 * 10 pages × 20 items = 200 items before Policy Engine filtering.
 * Expected ~100 eligible items after filtering (~50% pass rate).
 */
export const TRENDING_DEFAULT_PAGES = 10;

/**
 * Default limit for trending stats sync.
 * Reduced from 200 to 50 to avoid Trakt rate limiting.
 * Each item requires ~4 API calls, so 50 items = ~200 calls.
 */
export const TRENDING_DEFAULT_STATS_LIMIT = 50;

/**
 * Maximum batches for eligible trending backfill per pipeline run.
 * Limits API calls to avoid rate limiting during scheduled sync.
 * 2 batches × 50 items = 100 items max; HTTP calls bounded by chunking
 * (e.g., ceil(50/10) = 5 calls per media type per batch).
 * Remaining items will be processed in next scheduled run.
 */
export const ELIGIBLE_BACKFILL_MAX_BATCHES = 2;

/**
 * Items per page in TMDB trending API.
 */
export const TMDB_TRENDING_PAGE_SIZE = 20;

/**
 * Concurrency for job deduplication checks in Redis.
 */
export const JOB_DEDUPE_CHECK_CONCURRENCY = 50;

/**
 * Batch size for alternative titles backfill dispatcher pagination.
 */
export const BACKFILL_ALT_TITLES_BATCH_SIZE = 100;

/**
 * Batch size for MDBList ratings backfill dispatcher pagination.
 * Kept small because the MDBList free-tier budget is 1000 req/day —
 * dispatcher runs once per day, so queueing the whole day's quota at
 * once is enough. Worker limiter enforces the per-hour pace.
 */
export const BACKFILL_MDBLIST_RATINGS_BATCH_SIZE = 100;

/**
 * Minimum days to wait before re-checking a media item whose MDBList
 * ratings fetch was already attempted. Without this, items for which
 * MDBList has no RT data would be re-polled on every dispatcher run
 * and silently burn the daily quota.
 *
 * 90 days is long enough that MDBList genuinely may have received new
 * data for the title (e.g. newly reviewed indie film), short enough
 * that users see updates within a season.
 */
export const MDBLIST_RATINGS_REFRESH_DAYS = 90;

/**
 * Hard cap on jobs the MDBList dispatcher may enqueue per run.
 *
 * MUST stay below the daily processing capacity (worker limiter is 40/hour
 * = 960/day). Without this cap, a single dispatcher run would enqueue the
 * full candidate set (~50k items) into Redis, bloat memory, and then on
 * the next run it would enqueue duplicates (day-scoped jobIds), doubling
 * backlog each day. The worker would still burn quota on those duplicates
 * unless processItem also re-checks freshness — which it does, but the
 * cap is the primary defence.
 *
 * Value matches the free-tier daily throughput with a small retry margin.
 */
export const MDBLIST_DAILY_BUDGET = 900;

/**
 * Hard cap on jobs the IMDb / alt-titles backfill dispatchers may enqueue
 * per run.
 *
 * TMDB allows ~40 req/s (worker limiter: 600/min = 36k/hour), so throughput
 * is not the constraint — Redis memory is. A one-shot run on a fresh DB
 * could otherwise enqueue 100k+ items at once. At 20k per run the dispatcher
 * drains in ~35 minutes, then next run picks up the remainder. Repeat
 * daily triggers until fully drained.
 */
export const TMDB_BACKFILL_RUN_CAP = 20_000;
