import type { SourceReading } from '../entities/source-reading';

export const SeriesMetric = {
  NEW_USERS: 'new_users',
  ACTIONS: 'actions',
  ACTIVE_USERS: 'active_users',
} as const;
export type SeriesMetric = (typeof SeriesMetric)[keyof typeof SeriesMetric];

export interface DailyValue {
  day: string;
  value: number;
}

export interface ProductSeriesPort {
  series(
    metric: SeriesMetric,
    firstDay: string,
    lastDay: string,
  ): Promise<SourceReading<DailyValue[]>>;
}

export const PRODUCT_SERIES_PORT = Symbol('PRODUCT_SERIES_PORT');
