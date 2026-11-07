import { type BackfillChunkItem } from './backfill.types';

export interface StatsJobData {
  limit?: number;
  batchSize?: number;
  afterId?: string;
  tmdbId?: number;
}

export interface BackfillWatchersChunkJobData {
  items: BackfillChunkItem[];
  chunkIndex: number;
  totalChunks: number;
}
