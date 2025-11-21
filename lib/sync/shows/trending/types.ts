/**
 * @fileoverview Types for trending shows domain
 *
 * @module shows/trending/types
 */

import type { LRUCache } from '@/lib/sync/utils';
import type {
  TMDBShowDetails,
  TMDBShowTranslation,
  WatchProvider,
  TMDBExternalIds,
  TraktTrendingShow,
} from '@/lib/types';

// Cache interfaces
export interface TrendingShowsCache {
  details: LRUCache<number, TMDBShowDetails>;
  translations: LRUCache<number, TMDBShowTranslation>;
  providers: LRUCache<string, WatchProvider[]>;
  externalIds: LRUCache<number, TMDBExternalIds>;
}

// Processing types
export interface ShowProcessingOptions {
  monthly: any;
  maxWatchers: number;
  tmdbDetailsCache: LRUCache<number, TMDBShowDetails>;
  tmdbTranslationCache: LRUCache<number, TMDBShowTranslation>;
  tmdbProvidersCache: LRUCache<string, WatchProvider[]>;
  tmdbExternalIdsCache: LRUCache<number, TMDBExternalIds>;
}

export interface ShowProcessingResult {
  success: boolean;
  showId?: number;
  error?: string;
  skipped?: boolean;
  updated?: number;
  added?: number;
  ratingsUpdated?: number;
  bucketsUpserted?: number;
  snapshotsInserted?: number;
  snapshotsUnchanged?: number;
  snapshotsProcessed?: number;
}

// Task types
export interface TaskData {
  tmdbId: number;
  traktShow: TraktTrendingShow;
  jobId: number;
}

export interface SyncTask {
  id: number;
  jobId: number;
  tmdbId: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  payload: any;
  createdAt: Date;
  updatedAt: Date;
}

// Job types
export interface SyncJob {
  id: number;
  type: 'trending' | 'backfill';
  status: 'pending' | 'running' | 'completed' | 'error';
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  createdAt: Date;
  updatedAt: Date;
}

// Trakt types
export interface TraktTrendingOptions {
  limit?: number;
  staleMinutes?: number;
  maxWatchers?: number;
}

export interface TraktShowData {
  watchers: number;
  show: TraktTrendingShow;
}

// Status types
export interface ShowStatus {
  isPending: boolean;
  isProcessing: boolean;
  isCompleted: boolean;
  hasError: boolean;
}
