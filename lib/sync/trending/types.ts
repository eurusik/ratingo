/**
 * Типи та інтерфейси для trending модуля
 */

import type { BackfillOmdbStats, BackfillShowsMetaStats } from '@/lib/types';

/**
 * Результат обробки trending синхронізації
 */
export interface TrendingSyncResult {
  success: boolean;
  updated: number;
  added: number;
  skipped: number;
  timestamp: string;
  totals: {
    trendingFetched: number | null;
  };
  related: {
    linksAdded: number;
    showsInserted: number;
    source: {
      trakt: number;
      tmdb: number;
    };
    candidatesTotal: number;
    showsWithCandidates: number;
  };
  ratings: {
    updated: number;
    bucketsUpserted: number;
  };
  prune: {
    airingsDeleted: number;
  };
  backfill: {
    omdbUpdated: number;
    metaUpdated: number;
  };
  snapshots: {
    inserted: number;
    unchanged: number;
    processed: number;
  };
  perf: {
    phases: PerformancePhases;
    retries: Record<string, number>;
  };
  errors?: string[];
  errorCount?: number;
}

/**
 * Показники продуктивності по фазам
 */
export interface PerformancePhases {
  trendingFetchMs: number;
  monthlyMapsMs: number;
  perShowAvgMs: number;
  perShowMaxMs: number;
  omdbBackfillMs: number;
  metaBackfillMs: number;
  calendarSyncMs: number;
  pruneMs: number;
}

/**
 * Кеші для TMDB даних
 */
export interface TrendingCaches {
  tmdbDetailsCache: LRUCache<number, any>;
  tmdbTranslationCache: LRUCache<number, any>;
  tmdbProvidersCache: LRUCache<string, any[]>;
  tmdbContentRatingCache: LRUCache<string, any>;
  tmdbExternalIdsCache: LRUCache<number, any>;
}

/**
 * Конфігурація для обробки шоу
 */
export interface ShowProcessingConfig {
  monthly: any;
  maxWatchers: number;
  animeKeywords: string[];
  tmdbDetailsCache: LRUCache<number, any>;
  tmdbTranslationCache: LRUCache<number, any>;
  tmdbProvidersCache: LRUCache<string, any[]>;
  tmdbContentRatingCache: LRUCache<string, any>;
  tmdbExternalIdsCache: LRUCache<number, any>;
  currentTrendingTmdbIds: Set<number>;
  onRetryLabel: (label: string) => (attempt: number, err: any) => void;
}

/**
 * Результат обробки окремого шоу
 */
export interface ShowProcessingResult {
  skipped: boolean;
  updated?: number;
  added?: number;
  ratingsUpdated?: number;
  bucketsUpserted?: number;
  snapshotsInserted?: number;
  snapshotsUnchanged?: number;
  snapshotsProcessed?: number;
  relatedShowsInserted?: number;
  relatedLinksAdded?: number;
  relatedSourceCounts?: {
    trakt: number;
    tmdb: number;
  };
  relatedCandidatesTotal?: number;
  relatedShowsWithCandidates?: number;
  error?: string;
}

/**
 * Стан виконання trending синхронізації
 */
export interface TrendingSyncState {
  errors: string[];
  updated: number;
  added: number;
  skipped: number;
  relatedShowsInserted: number;
  relatedLinksAdded: number;
  relatedSourceCounts: { trakt: number; tmdb: number };
  relatedCandidatesTotal: number;
  relatedShowsWithCandidates: number;
  calendarProcessed: number;
  calendarInserted: number;
  calendarUpdated: number;
  pruneDeleted: number;
  omdbBackfillUpdated: number;
  metaBackfillUpdated: number;
  ratingsUpdated: number;
  bucketsUpserted: number;
  snapshotsInserted: number;
  snapshotsUnchanged: number;
  snapshotsProcessed: number;
}

/**
 * Простий LRU кеш (буде замінений на імпорт з utils)
 */
interface LRUCache<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  has(key: K): boolean;
}
