import { type NormalizedEpisode } from './normalized-media.model';

export type EpisodesBySeason = ReadonlyMap<number, readonly NormalizedEpisode[]>;

export interface TmdbSeasonEpisodes {
  localized: EpisodesBySeason;
  english: EpisodesBySeason;
}

export interface TmdbEpisodeSources {
  episodes: TmdbSeasonEpisodes;
  failedSeasons: number[];
}

export interface MergeableEpisode<Title extends string | null> {
  number: number;
  title: Title;
  overview?: string | null;
  airDate?: Date | null;
  runtime?: number | null;
  stillPath?: string | null;
  rating?: number | null;
}

export type PairableEpisode = Pick<MergeableEpisode<string | null>, 'number' | 'title' | 'airDate'>;

export interface TvMazeEpisodeText {
  seasonNumber: number;
  number: number;
  title: string;
  overview?: string | null;
  airDate?: Date | null;
}
