export interface TrackedShowStatus {
  mediaItemId: string;
  status: string | null;
}

export interface TrackedShowCore {
  mediaItemId: string;
  status: string | null;
  totalSeasons: number | null;
  nextAirDate: Date | null;
}

export interface LastAiredEpisode {
  seasonNumber: number;
  episodeNumber: number;
  airDate: Date | null;
}

export interface ITrackedShowRepository {
  findShowStatus(tmdbId: number): Promise<TrackedShowStatus | null>;

  findShowCore(tmdbId: number): Promise<TrackedShowCore | null>;

  findLastAiredEpisode(tmdbId: number): Promise<LastAiredEpisode | null>;
}

export const TRACKED_SHOW_REPOSITORY = Symbol('TRACKED_SHOW_REPOSITORY');
