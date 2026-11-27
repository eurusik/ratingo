import type { z } from 'zod';

import type { OpsExecutors } from '@ratingo/ai-ops-tools';

import type { askHappyInput, productStatsInput, recentChangesInput } from './investigation-tools';

export type ProductStatsInput = z.infer<typeof productStatsInput>;
export type RecentChangesInput = z.infer<typeof recentChangesInput>;
export type AskHappyInput = z.infer<typeof askHappyInput>;

export interface InvestigationExecutors extends OpsExecutors {
  productStats(input: ProductStatsInput): Promise<unknown>;
  digestSnapshot(): Promise<unknown>;
  recentChanges(input: RecentChangesInput): Promise<unknown>;
  askHappy(input: AskHappyInput): Promise<unknown>;
}

export const INVESTIGATION_EXECUTORS = Symbol('INVESTIGATION_EXECUTORS');
