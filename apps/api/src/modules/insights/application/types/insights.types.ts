import { RiseFallItem } from '../../domain/models/rise-fall.model';

/**
 * Query input for rise/fall movements.
 */
export type RiseFallQuery = {
  window: '30d' | '90d' | '365d';
  limit: number;
};

/**
 * Result of rise/fall query.
 */
export type RiseFallResult = {
  window: '30d' | '90d' | '365d';
  region: string;
  metric: string;
  risers: RiseFallItem[];
  fallers: RiseFallItem[];
};
