import {
  CLIENT_REQUESTS_METRIC,
  QUEUE_JOBS_METRIC,
  type PrometheusSeries,
} from '@ratingo/ai-ops-tools';

const outgoing = (provider: string, status: string, value: number): PrometheusSeries => ({
  metric: CLIENT_REQUESTS_METRIC,
  labels: { server_address: provider, http_response_status_code: status },
  value,
});

export const PROVIDER_REQUESTS: readonly PrometheusSeries[] = [
  outgoing('api.trakt.tv', '200', 9_000),
  outgoing('api.trakt.tv', '429', 37),
  outgoing('api.themoviedb.org', '200', 9_411),
  outgoing('api.themoviedb.org', '429', 2),
];

const backlog = (queue: string, waiting: number, peak: number): PrometheusSeries => ({
  metric: QUEUE_JOBS_METRIC,
  labels: { queue, state: 'waiting' },
  value: waiting,
  peak,
});

export const QUEUE_BACKLOGS: readonly PrometheusSeries[] = [
  backlog('ingestion', 120, 940),
  backlog('stats-queue', 3, 12),
];
