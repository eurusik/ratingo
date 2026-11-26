export const USER_NOTIFICATIONS_QUEUE = 'user-notifications';

export const USER_NOTIFICATIONS_JOB = {
  NOTIFY_MOVIE_RELEASES: 'notify-movie-releases',
} as const;

export const MOVIE_RELEASE_NOTIFICATIONS_SCHEDULER_ID = 'movie-release-notifications';

export const MOVIE_RELEASE_NOTIFICATIONS_PATTERN = '0 6 * * *';

export const MOVIE_RELEASE_NOTIFICATIONS_DESCRIPTION =
  'Notifies users that a movie they want to watch has been released.';

export const USER_NOTIFICATIONS_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 60_000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 50 },
  removeOnFail: { age: 30 * 24 * 3600, count: 50 },
} as const;
