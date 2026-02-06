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
}

export interface IEpisodeProgressRepository {
  markWatched(userId: string, episodeId: string): Promise<void>;
  markUnwatched(userId: string, episodeId: string): Promise<void>;
  getShowProgress(userId: string, showId: string): Promise<SeasonProgressInfo[]>;
  getWatchedEpisodeIds(userId: string, showId: string): Promise<string[]>;
  markManyWatched(userId: string, episodeIds: string[]): Promise<void>;
  markManyUnwatched(userId: string, episodeIds: string[]): Promise<void>;
  countDistinctShowsForEpisodes(episodeIds: string[]): Promise<number>;
  getEpisodeMediaInfo(episodeId: string): Promise<EpisodeMediaInfo | null>;
}
