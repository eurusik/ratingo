import { MS_PER_DAY } from '@/common/constants';
import { pickUkrainianEpisodeTitle, pickUkrainianText } from '@/modules/shared/episode-text';

import {
  SPECIALS_SEASON_NUMBER,
  TMDB_AIR_DATE_SETTLE_DAYS,
} from './constants/episode-details.constants';
import { pairTmdbEpisodes } from './episode-pairing';
import { type EpisodeDetails } from './models/episode-details.model';
import { type MergeableEpisode, type TmdbSeasonEpisodes } from './models/episode-sources.model';
import { type NormalizedEpisode, type NormalizedSeason } from './models/normalized-media.model';

const TMDB_AIR_DATE_SETTLE_MS = TMDB_AIR_DATE_SETTLE_DAYS * MS_PER_DAY;

function settledTmdbAirDate(airDate: Date | null | undefined, nowMs: number): Date | null {
  return airDate && airDate.getTime() + TMDB_AIR_DATE_SETTLE_MS <= nowMs ? airDate : null;
}

export function withTmdbDetails<Title extends string | null>(
  episode: MergeableEpisode<Title>,
  tmdb: NormalizedEpisode,
  nowMs: number,
): EpisodeDetails & { title: string | Title } {
  return {
    title: pickUkrainianEpisodeTitle(tmdb.title) ?? episode.title,
    overview: pickUkrainianText(tmdb.overview) ?? episode.overview ?? null,
    airDate: episode.airDate ?? settledTmdbAirDate(tmdb.airDate, nowMs),
    runtime: episode.runtime ?? tmdb.runtime ?? null,
    stillPath: episode.stillPath ?? tmdb.stillPath ?? null,
    rating: episode.rating ?? tmdb.rating ?? null,
  };
}

export function mergeTmdbEpisodeDetails(
  seasons: readonly NormalizedSeason[],
  tmdb: TmdbSeasonEpisodes,
  nowMs: number,
): NormalizedSeason[] {
  return seasons.map((season) => {
    const pairs = pairTmdbEpisodes(season.number, season.episodes, tmdb);
    if (pairs.size === 0) return season;

    return {
      ...season,
      episodes: season.episodes.map((episode) => {
        const twin = pairs.get(episode.number);
        return twin ? { ...episode, ...withTmdbDetails(episode, twin, nowMs) } : episode;
      }),
    };
  });
}

function earliestAirDate(episodes: readonly NormalizedEpisode[]): Date | null {
  return episodes.reduce<Date | null>(
    (earliest, { airDate }) => (airDate && (!earliest || airDate < earliest) ? airDate : earliest),
    null,
  );
}

export function fillSeasonAirDates(seasons: readonly NormalizedSeason[]): NormalizedSeason[] {
  return seasons.map((season) => {
    if (season.airDate) return season;
    const firstAired = earliestAirDate(season.episodes);
    return firstAired ? { ...season, airDate: firstAired } : season;
  });
}

export function latestAiredDate(seasons: readonly NormalizedSeason[], nowMs: number): Date | null {
  return seasons
    .filter((season) => season.number > SPECIALS_SEASON_NUMBER)
    .flatMap((season) => season.episodes)
    .reduce<Date | null>(
      (latest, { airDate }) =>
        airDate && airDate.getTime() <= nowMs && (!latest || airDate > latest) ? airDate : latest,
      null,
    );
}
