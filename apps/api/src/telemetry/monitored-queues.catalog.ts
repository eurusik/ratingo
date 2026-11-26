import { CATALOG_POLICY_QUEUE } from '../modules/catalog-policy/public';
import {
  BACKFILL_QUEUE,
  INGESTION_QUEUE,
  RATINGS_BACKFILL_QUEUE,
} from '../modules/ingestion/public';
import { MONITORING_QUEUE } from '../modules/monitoring/public';
import { STATS_QUEUE } from '../modules/stats/public';
import { USER_NOTIFICATIONS_QUEUE } from '../modules/user-actions/public';

export interface MonitoredQueueEntry {
  name: string;
  description: string;
}

export const MONITORED_QUEUES: readonly MonitoredQueueEntry[] = [
  {
    name: INGESTION_QUEUE,
    description:
      'Imports and refreshes titles from rate-limited providers; scheduled syncs land here, so backlog spikes after them are normal.',
  },
  {
    name: BACKFILL_QUEUE,
    description:
      'Fast TMDB-only fill-ins (missing IDs, alternative titles) and watch history imports.',
  },
  {
    name: RATINGS_BACKFILL_QUEUE,
    description:
      'External ratings under a small daily quota; drains slowly all day by design, so a long backlog is normal.',
  },
  {
    name: CATALOG_POLICY_QUEUE,
    description: 'Decides which titles are eligible for the public catalog.',
  },
  { name: STATS_QUEUE, description: 'Recomputes title stats and the homepage blocks.' },
  { name: MONITORING_QUEUE, description: 'Health probes such as the API key check.' },
  { name: USER_NOTIFICATIONS_QUEUE, description: 'Notifications sent to users.' },
];
