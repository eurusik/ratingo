import type { SimulatedJobFailureDay } from '@ratingo/ai-ops-tools';

import { kyivDayOf, minutesAgoMs } from '../eval-clock';

const TODAY = kyivDayOf(minutesAgoMs(0));

const day = (
  overrides: Partial<SimulatedJobFailureDay> & Pick<SimulatedJobFailureDay, 'jobType' | 'failures'>,
): SimulatedJobFailureDay => ({
  day: TODAY,
  schedulerJobId: null,
  queue: 'ingestion',
  errorClass: 'timeout',
  exhausted: 0,
  firstFailedAtMs: minutesAgoMs(400),
  lastFailedAtMs: minutesAgoMs(35),
  lastMessage: 'TMDB API: Request timeout',
  ...overrides,
});

export const FAILURES_TODAY: readonly SimulatedJobFailureDay[] = [
  day({ jobType: 'sync-show', failures: 31, exhausted: 9 }),
  day({
    jobType: 'sync-trending-dispatcher',
    schedulerJobId: 'scheduled-trending',
    failures: 12,
    errorClass: 'rate_limit',
    lastMessage: 'Trakt API: 429 Too Many Requests',
    lastFailedAtMs: minutesAgoMs(120),
  }),
  day({
    jobType: 'sync-stats',
    queue: 'stats-queue',
    failures: 4,
    errorClass: 'network',
    lastMessage: 'connect ECONNRESET',
    lastFailedAtMs: minutesAgoMs(300),
  }),
];
