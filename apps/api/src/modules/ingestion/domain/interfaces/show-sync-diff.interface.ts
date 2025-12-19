/**
 * Represents changes detected during show synchronization.
 * Used to trigger notifications for subscribed users.
 */
export interface ShowSyncDiff {
  /** TMDB ID of the show */
  tmdbId: number;

  /** Internal media item ID */
  mediaItemId: string;

  /** Whether any trackable changes were detected */
  hasChanges: boolean;

  /** Detected changes */
  changes: ShowSyncChanges;
}

/**
 * Individual change types that can be detected during sync.
 */
export interface ShowSyncChanges {
  /**
   * New episode detected.
   * Triggers 'new_episode' subscription notifications.
   */
  newEpisode?: {
    season: number;
    episode: number;
    /** ISO date string: 'YYYY-MM-DD' */
    airDate: string;
    /** Dedup marker: 'S2E5' format */
    key: string;
  };

  /**
   * New season detected.
   * Triggers 'new_season' subscription notifications.
   */
  newSeason?: {
    seasonNumber: number;
    /** ISO date string: 'YYYY-MM-DD' */
    airDate: string;
    /** Dedup marker: season number as string */
    key: string;
  };

  /**
   * Show status changed (e.g., 'Returning Series' -> 'Ended').
   * Triggers 'status_changed' subscription notifications.
   */
  statusChanged?: {
    from: string | null;
    to: string;
  };

  /**
   * Next air date changed.
   * Informational only, no notification triggered.
   */
  nextAirDateChanged?: {
    /** ISO date string or null */
    from: string | null;
    /** ISO date string or null */
    to: string | null;
  };
}

/**
 * Creates an empty diff with no changes.
 */
export function createEmptyDiff(tmdbId: number, mediaItemId: string): ShowSyncDiff {
  return {
    tmdbId,
    mediaItemId,
    hasChanges: false,
    changes: {},
  };
}

/**
 * Formats episode key for dedup: 'S2E5'
 */
export function formatEpisodeKey(season: number, episode: number): string {
  return `S${season}E${episode}`;
}

/**
 * Formats season key for dedup: '3'
 */
export function formatSeasonKey(seasonNumber: number): string {
  return String(seasonNumber);
}

/**
 * Formats date to ISO string 'YYYY-MM-DD' or returns null.
 */
export function formatDateToIso(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().split('T')[0];
}
