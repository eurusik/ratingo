import {
  clientErrors,
  clientRequests,
  queueBacklog,
  queueBacklogPeak,
  type PrometheusAnswer,
} from '@ratingo/ai-ops-tools';

const DAY_WINDOWS = ['24h', '1d'] as const;
const QUEUE_FILTERS: readonly (string | undefined)[] = [undefined, 'ingestion'];

const OUTGOING_REQUESTS = 18_450;
const TRAKT_LIMITED = 37;
const TMDB_LIMITED = 2;

export const PROVIDER_LIMITS: readonly PrometheusAnswer[] = DAY_WINDOWS.flatMap((window) => [
  { promql: clientRequests(window), samples: [{ labels: {}, value: OUTGOING_REQUESTS }] },
  {
    promql: clientErrors(window),
    samples: [
      {
        labels: { server_address: 'api.trakt.tv', http_response_status_code: '429' },
        value: TRAKT_LIMITED,
      },
      {
        labels: { server_address: 'api.themoviedb.org', http_response_status_code: '429' },
        value: TMDB_LIMITED,
      },
    ],
  },
]);

const BACKLOG_NOW = [
  { labels: { queue: 'ingestion' }, value: 120 },
  { labels: { queue: 'stats-queue' }, value: 3 },
];
const BACKLOG_PEAK = [
  { labels: { queue: 'ingestion' }, value: 940 },
  { labels: { queue: 'stats-queue' }, value: 12 },
];

const onlyQueue = (samples: typeof BACKLOG_NOW, queue: string | undefined): typeof BACKLOG_NOW =>
  queue === undefined ? samples : samples.filter((sample) => sample.labels.queue === queue);

export const QUEUE_BACKLOGS: readonly PrometheusAnswer[] = QUEUE_FILTERS.flatMap((queue) => [
  { promql: queueBacklog(queue), samples: onlyQueue(BACKLOG_NOW, queue) },
  ...DAY_WINDOWS.map((window) => ({
    promql: queueBacklogPeak(window, queue),
    samples: onlyQueue(BACKLOG_PEAK, queue),
  })),
]);
