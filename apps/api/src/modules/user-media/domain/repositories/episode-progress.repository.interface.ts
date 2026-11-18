export const EPISODE_PROGRESS_REPOSITORY = Symbol('EPISODE_PROGRESS_REPOSITORY');

export interface SeasonProgressInfo {
  seasonNumber: number;
  watchedCount: number;
  totalCount: number;
  watchedEpisodeIds: string[];
}

/** Subset of episode data needed for user-media state sync. */
export interface EpisodeMediaInfo {
  episodeId: string;
  showId: string;
  mediaItemId: string;
  seasonNumber: number;
  episodeNumber: number;
  airDate: Date | null;
}

/** Result of validating a batch of episode IDs. */
export interface EpisodeBatchValidation {
  existingCount: number;
  distinctShowCount: number;
  unairedCount: number;
}

export interface IEpisodeProgressRepository {
  markWatched(userId: string, episodeId: string): Promise<void>;
  markUnwatched(userId: string, episodeId: string): Promise<void>;
  getShowProgress(userId: string, showId: string, asOf: Date): Promise<SeasonProgressInfo[]>;
  getWatchedEpisodeIds(userId: string, showId: string): Promise<string[]>;
  markManyWatched(userId: string, episodeIds: string[]): Promise<void>;
  markManyUnwatched(userId: string, episodeIds: string[]): Promise<void>;
  validateEpisodeBatch(episodeIds: string[], asOf: Date): Promise<EpisodeBatchValidation>;
  getEpisodeMediaInfo(episodeId: string): Promise<EpisodeMediaInfo | null>;
  countWatchedForMedia(userId: string, mediaItemId: string): Promise<number>;
  deleteAllForMedia(userId: string, mediaItemId: string): Promise<void>;
}
