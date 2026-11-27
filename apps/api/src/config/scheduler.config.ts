import { registerAs } from '@nestjs/config';

import { CATALOG_DEFAULT_NEW_RELEASE_DAYS, NEW_RELEASES_REGION } from '../common/constants';

/**
 * Scheduled job definition.
 */
export interface ScheduledJobConfig {
  /** Unique job name for logging and identification */
  name: string;
  /** BullMQ job type (must match IngestionJob enum) */
  jobType: string;
  /** Whether this job is enabled */
  enabled: boolean;
  /** Cron pattern (e.g., "0 8,20 * * *") */
  pattern: string;
  /** Unique jobId for BullMQ (prevents duplicates) */
  jobId: string;
  /** Optional job payload data */
  data?: Record<string, unknown>;
  description: string;
}

/**
 * Full scheduler configuration.
 */
interface SchedulerConfig {
  /** Master switch to enable/disable all scheduled jobs */
  enabled: boolean;
  /** Timezone for all scheduled jobs */
  timezone: string;
  /** Namespace prefix for Redis keys (derived from APP_ENV or NODE_ENV) */
  envPrefix: string;
  /** List of scheduled jobs */
  jobs: ScheduledJobConfig[];
}

/**
 * Default job configurations.
 * Pattern format: "minute hour day month weekday"
 *
 * Examples:
 *   "0 8,20 * * *"  → 8:00 and 20:00 daily
 *   "0 3 * * *"     → 3:00 daily
 *   "0 *\/6 * * *"  → every 6 hours
 *   "0 6 * * *"     → 6:00 daily
 *   "0 4 * * 1"     → Monday 4:00
 */
export const INGESTION_SCHEDULED_JOBS: readonly Omit<ScheduledJobConfig, 'enabled'>[] = [
  {
    name: 'trackedShows',
    jobType: 'sync-tracked-shows',
    pattern: '0 8,20 * * *', // 8:00 and 20:00 UTC daily
    jobId: 'scheduled-tracked-shows',
    description: 'Refreshes the shows users track, so new episodes and seasons show up.',
    data: {},
  },
  {
    name: 'snapshots',
    jobType: 'sync-snapshots',
    pattern: '30 3 * * *', // Once daily at 3:30 UTC (off-peak)
    jobId: 'scheduled-snapshots',
    description:
      'Records the daily watcher and rating snapshot of catalog titles that trend charts are built from.',
    data: {},
  },
  {
    name: 'trending',
    jobType: 'sync-trending-dispatcher',
    pattern: '0 */4 * * *', // Every 4 hours
    jobId: 'scheduled-trending',
    description:
      'Pulls trending movies and shows with their stats and rebuilds the trending lists.',
    data: { pages: 10, syncStats: true }, // ~200 items before Policy Engine → ~100 eligible
  },
  {
    name: 'nowPlaying',
    jobType: 'sync-now-playing',
    pattern: '0 6 * * *', // 6:00 UTC daily
    jobId: 'scheduled-now-playing',
    description: 'Fetches the movies now playing in cinemas in the region.',
    data: { region: 'UA' },
  },
  {
    name: 'nowPlayingFlags',
    jobType: 'update-now-playing-flags',
    pattern: '30 6 * * *', // 6:30 UTC daily (30 min after now-playing)
    jobId: 'scheduled-now-playing-flags',
    description:
      'Marks which catalog movies are in cinemas now; runs right after the now-playing sync.',
    data: { region: 'UA' },
  },
  {
    name: 'newReleases',
    jobType: 'sync-new-releases',
    pattern: '0 4 * * *', // Daily 4:00 UTC
    jobId: 'scheduled-new-releases',
    description: 'Adds movies released in the region over the last weeks.',
    data: { region: NEW_RELEASES_REGION, daysBack: CATALOG_DEFAULT_NEW_RELEASE_DAYS },
  },
  {
    name: 'upcomingMovies',
    jobType: 'sync-upcoming-movies',
    pattern: '0 5 * * *',
    jobId: 'scheduled-upcoming-movies',
    description: 'Adds upcoming movie premieres to the catalog.',
    data: {},
  },
  {
    name: 'upcomingMoviesRefreshSoon',
    jobType: 'refresh-upcoming-movies',
    pattern: '0 7 * * 0,2-6',
    jobId: 'scheduled-upcoming-movies-refresh-soon',
    description:
      'Refreshes release dates of upcoming movies premiering soon; skips Monday, when the full refresh runs.',
    data: { scope: 'soon' },
  },
  {
    name: 'upcomingMoviesRefreshAll',
    jobType: 'refresh-upcoming-movies',
    pattern: '0 7 * * 1',
    jobId: 'scheduled-upcoming-movies-refresh-all',
    description:
      'Refreshes release dates of all upcoming movies; on the other days only the ones premiering soon are refreshed.',
    data: { scope: 'all' },
  },
  {
    name: 'anticipatedShows',
    jobType: 'sync-anticipated-shows',
    pattern: '30 5 * * *',
    jobId: 'scheduled-anticipated-shows',
    description: 'Pulls the most anticipated new shows.',
    data: {},
  },
  {
    name: 'mdblistRatings',
    jobType: 'backfill-mdblist-ratings-dispatcher',
    // 02:00 UTC daily — safely after MDBList's 00:00 UTC quota reset.
    // Dispatcher caps at 900 items per run; worker drains them at 40/hour
    // (~23h), leaving headroom before next fire.
    pattern: '0 2 * * *',
    jobId: 'scheduled-mdblist-ratings',
    description:
      'Queues titles missing Rotten Tomatoes ratings; the ratings-backfill queue then drains them slowly through the day because of the daily quota.',
    data: {},
  },
  {
    name: 'episodeDetails',
    jobType: 'backfill-episode-details-dispatcher',
    pattern: '0 1 * * 0',
    jobId: 'scheduled-episode-details',
    description:
      'Fills episode texts, stills, runtimes, ratings and air dates from TMDB for shows the regular syncs no longer touch.',
    data: {},
  },
];

/**
 * Helper to get env override for a job property.
 * Format: SCHEDULER_INGESTION_{JOB_NAME}_{PROPERTY}
 * Example: SCHEDULER_INGESTION_TRACKED_SHOWS_PATTERN
 */
function getEnvOverride(jobName: string, property: string): string | undefined {
  const envKey = `SCHEDULER_INGESTION_${jobName.replace(/([A-Z])/g, '_$1').toUpperCase()}_${property.toUpperCase()}`;
  return process.env[envKey];
}

/**
 * Build job config with env overrides.
 */
function buildJobConfig(defaultJob: Omit<ScheduledJobConfig, 'enabled'>): ScheduledJobConfig {
  const enabledEnv = getEnvOverride(defaultJob.name, 'ENABLED');
  const patternEnv = getEnvOverride(defaultJob.name, 'PATTERN');

  return {
    ...defaultJob,
    enabled: enabledEnv !== 'false', // Enabled by default
    pattern: patternEnv || defaultJob.pattern,
  };
}

export default registerAs('scheduler', (): SchedulerConfig => ({
  enabled: process.env.SCHEDULER_ENABLED !== 'false', // Enabled by default
  timezone: process.env.SCHEDULER_TIMEZONE || 'UTC',
  envPrefix: process.env.APP_ENV || process.env.NODE_ENV || 'dev',
  jobs: INGESTION_SCHEDULED_JOBS.map(buildJobConfig),
}));

export interface MonitoringKeyHealthOverride {
  enabled: boolean;
  pattern: string | undefined;
}

export function getMonitoringKeyHealthOverride(): MonitoringKeyHealthOverride {
  return {
    enabled: process.env.SCHEDULER_MONITORING_KEY_HEALTH_ENABLED !== 'false',
    pattern: process.env.SCHEDULER_MONITORING_KEY_HEALTH_PATTERN || undefined,
  };
}
