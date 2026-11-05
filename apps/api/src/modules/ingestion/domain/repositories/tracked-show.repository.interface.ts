export interface TrackedShow {
  mediaItemId: string;
  status: string | null;
  totalSeasons: number | null;
  nextAirDate: Date | null;
}

export interface AiredEpisode {
  seasonNumber: number;
  episodeNumber: number;
  airDate: Date | null;
}

export interface ITrackedShowRepository {
  findByTmdbId(tmdbId: number): Promise<TrackedShow | null>;
  findLatestEpisodeAiredBy(tmdbId: number, airedBy: Date): Promise<AiredEpisode | null>;
}

export const TRACKED_SHOW_REPOSITORY = Symbol('TRACKED_SHOW_REPOSITORY');
