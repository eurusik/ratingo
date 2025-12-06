export type MonthlyMaps = {
  m0: Record<number, number>;
  m1: Record<number, number>;
  m2: Record<number, number>;
  m3: Record<number, number>;
  m4: Record<number, number>;
  m5: Record<number, number>;
};

export type RunnerResult = {
  success: boolean;
  updated: number;
  added: number;
  skipped: number;
  totals: { trendingFetched: number | null };
  related: {
    linksAdded: number;
    showsInserted: number;
    source: { trakt: number; tmdb: number };
    candidatesTotal: number;
    showsWithCandidates: number;
  };
  ratings: { updated: number; bucketsUpserted: number };
  prune: { airingsDeleted: number };
  backfill: { omdbUpdated: number; metaUpdated: number };
  snapshots?: { inserted: number; unchanged: number; processed: number };
  perf?: {
    phases: {
      trendingFetchMs: number;
      monthlyMapsMs: number;
      perShowAvgMs: number;
      perShowMaxMs: number;
      omdbBackfillMs: number;
      metaBackfillMs: number;
      calendarSyncMs: number;
      pruneMs: number;
    };
    retries: Record<string, number>;
  };
  errors?: string[];
  errorCount?: number;
  timestamp: string;
};
