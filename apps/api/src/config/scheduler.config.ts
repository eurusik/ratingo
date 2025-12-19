import { registerAs } from '@nestjs/config';

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
  data?: Record<string, any>;
}

/**
 * Full scheduler configuration.
 */
export interface SchedulerConfig {
  /** Master switch to enable/disable all scheduled jobs */
  enabled: boolean;
  /** Timezone for all scheduled jobs */
  timezone: string;
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
const DEFAULT_JOBS: Omit<ScheduledJobConfig, 'enabled'>[] = [
  {
    name: 'trackedShows',
    jobType: 'sync-tracked-shows',
    pattern: '0 8,20 * * *', // 8:00 and 20:00 UTC daily
    jobId: 'scheduled-tracked-shows',
    data: {},
  },
  {
    name: 'snapshots',
    jobType: 'sync-snapshots',
    pattern: '0 3 * * *', // 3:00 UTC daily
    jobId: 'scheduled-snapshots',
    data: {},
  },
  {
    name: 'trending',
    jobType: 'sync-trending-dispatcher',
    pattern: '0 */6 * * *', // Every 6 hours
    jobId: 'scheduled-trending',
    data: { pages: 5, syncStats: true }, // Top 100 (5 pages × 20 items)
  },
  {
    name: 'nowPlaying',
    jobType: 'sync-now-playing',
    pattern: '0 6 * * *', // 6:00 UTC daily
    jobId: 'scheduled-now-playing',
    data: { region: 'UA' },
  },
  {
    name: 'nowPlayingFlags',
    jobType: 'update-now-playing-flags',
    pattern: '30 6 * * *', // 6:30 UTC daily (30 min after now-playing)
    jobId: 'scheduled-now-playing-flags',
    data: { region: 'UA' },
  },
  {
    name: 'newReleases',
    jobType: 'sync-new-releases',
    pattern: '0 4 * * 1,4', // Monday and Thursday 4:00 UTC
    jobId: 'scheduled-new-releases',
    data: { region: 'UA', daysBack: 30 },
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

export default registerAs(
  'scheduler',
  (): SchedulerConfig => ({
    enabled: process.env.SCHEDULER_ENABLED !== 'false', // Enabled by default
    timezone: process.env.SCHEDULER_TIMEZONE || 'UTC',
    jobs: DEFAULT_JOBS.map(buildJobConfig),
  }),
);
