/**
 * A single entry from an external import source (e.g. Kinobaza CSV row).
 */
export interface ExternalMediaEntry {
  /** IMDB identifier, globally unique (e.g. "tt1234567"). */
  imdbId?: string;
  /** TMDB integer identifier. Unique per type, not globally. */
  tmdbId?: number;
  /**
   * Raw rating from the source on a 1-10 scale, already normalized
   * to internal 0-100 scale before being placed in this structure,
   * or null when no rating is present.
   */
  rating?: number | null;
  state: 'completed' | 'planned';
  /** Human-readable title from the source (for logging/reporting only). */
  title?: string;
  /** Release year from the source (used to resolve TMDB ambiguity). */
  year?: number;
}

export interface ImportCommand {
  userId: string;
  source: string;
  items: ExternalMediaEntry[];
  /** When true, existing entries are overwritten (with no-downgrade rule). */
  overwriteExisting: boolean;
}

export interface ImportOutcome {
  imported: number;
  skipped: number;
  notFound: number;
  durationMs: number;
  details: {
    imported: Array<{
      title?: string;
      mediaItemId: string;
      state: string;
      rating: number | null;
    }>;
    skipped: Array<{ title?: string; reason: string }>;
    notFound: Array<{ title?: string; imdbId?: string; tmdbId?: number }>;
  };
  /**
   * Present when not-found items were submitted for background auto-ingestion.
   * Clients can poll GET /user-media/import/status for progress updates.
   */
  pendingBatch?: {
    batchId: string;
    totalItems: number;
  };
}
