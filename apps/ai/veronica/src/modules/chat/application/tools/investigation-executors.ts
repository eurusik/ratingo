import type { z } from 'zod';

import type {
  metricsQueryInput,
  productStatsInput,
  recentChangesInput,
} from './investigation-tools';

export type MetricsQueryInput = z.infer<typeof metricsQueryInput>;
export type ProductStatsInput = z.infer<typeof productStatsInput>;
export type RecentChangesInput = z.infer<typeof recentChangesInput>;

export interface InvestigationExecutors {
  metricsQuery(input: MetricsQueryInput): Promise<unknown>;
  productStats(input: ProductStatsInput): Promise<unknown>;
  digestSnapshot(): Promise<unknown>;
  recentChanges(input: RecentChangesInput): Promise<unknown>;
}

export const INVESTIGATION_EXECUTORS = Symbol('INVESTIGATION_EXECUTORS');
