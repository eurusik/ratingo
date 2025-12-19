import { registerAs } from '@nestjs/config';

/**
 * Scheduler configuration for repeatable ingestion jobs.
 * All cron patterns use UTC timezone.
 *
 * Cron pattern format: "minute hour day month weekday"
 * Examples:
 *   "0 8,20 * * *"  → 8:00 and 20:00 daily
 *   "0 3 * * *"     → 3:00 daily
 *   "0 *\/6 * * *"  → every 6 hours
 *   "0 * * * *"     → every hour
 */
export default registerAs('scheduler', () => ({
  /**
   * Tracked shows sync schedule.
   * Syncs shows with active subscriptions to detect new episodes/seasons.
   * Default: twice daily at 8:00 and 20:00 UTC (10:00 and 22:00 Kyiv winter time)
   */
  trackedShows: {
    enabled: process.env.SCHEDULER_TRACKED_SHOWS_ENABLED !== 'false',
    pattern: process.env.SCHEDULER_TRACKED_SHOWS_PATTERN || '0 8,20 * * *',
    jobId: 'scheduled-tracked-shows',
  },

  /**
   * Daily snapshots sync schedule.
   * Updates watcher counts from Trakt.
   * Default: once daily at 3:00 UTC
   */
  snapshots: {
    enabled: process.env.SCHEDULER_SNAPSHOTS_ENABLED !== 'false',
    pattern: process.env.SCHEDULER_SNAPSHOTS_PATTERN || '0 3 * * *',
    jobId: 'scheduled-snapshots',
  },

  /**
   * Trending sync schedule.
   * Syncs trending content from TMDB.
   * Default: every 6 hours
   */
  trending: {
    enabled: process.env.SCHEDULER_TRENDING_ENABLED !== 'false',
    pattern: process.env.SCHEDULER_TRENDING_PATTERN || '0 */6 * * *',
    jobId: 'scheduled-trending',
  },

  /**
   * Timezone for all scheduled jobs.
   */
  timezone: process.env.SCHEDULER_TIMEZONE || 'UTC',
}));

/**
 * Type for scheduler configuration.
 */
export interface SchedulerConfig {
  trackedShows: {
    enabled: boolean;
    pattern: string;
    jobId: string;
  };
  snapshots: {
    enabled: boolean;
    pattern: string;
    jobId: string;
  };
  trending: {
    enabled: boolean;
    pattern: string;
    jobId: string;
  };
  timezone: string;
}
