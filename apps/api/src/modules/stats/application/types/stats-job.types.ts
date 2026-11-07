import { type BackfillChunkItem } from './backfill.types';

export interface SyncTrendingJobData {
  limit?: number;
}

export interface SyncEligibleTrendingJobData {
  batchSize?: number;
  afterId?: string;
}

export interface AnalyzeDropOffJobData {
  tmdbId?: number;
  limit?: number;
}

export type StatsJobData = SyncTrendingJobData &
  SyncEligibleTrendingJobData &
  AnalyzeDropOffJobData;

export interface BackfillWatchersChunkJobData {
  items: BackfillChunkItem[];
  chunkIndex: number;
  totalChunks: number;
}
