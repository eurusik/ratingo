import { pickUkrainianEpisodeTitle, pickUkrainianText } from '@/modules/shared/episode-text';

import {
  type EpisodeDetails,
  type EpisodeDetailsUpdate,
  type StoredEpisode,
} from './models/episode-details.model';
import { type NormalizedEpisode, type NormalizedSeason } from './models/normalized-media.model';

const SPECIALS_SEASON = 0;
const PARENTHESES = /\([^)]*\)/g;
const LEADING_ARTICLE = /^\s*the\s+/;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]/gu;
const NUMBERED_EPISODE_KEY = /^episode\d+$/;

type EpisodesBySeason = ReadonlyMap<number, readonly NormalizedEpisode[]>;

export interface TmdbSeasonEpisodes {
  localized: EpisodesBySeason;
  english: EpisodesBySeason;
}

interface MergeableEpisode<Title extends string | null> {
  number: number;
  title: Title;
  overview?: string | null;
  airDate?: Date | null;
  runtime?: number | null;
  stillPath?: string | null;
  rating?: number | null;
}

type PairableEpisode = Pick<MergeableEpisode<string | null>, 'number' | 'title'>;

function titleKey(title: string | null): string | null {
  const key = (title ?? '')
    .toLowerCase()
    .replace(PARENTHESES, '')
    .replace(LEADING_ARTICLE, '')
    .replace(NON_ALPHANUMERIC, '');
  return key && !NUMBERED_EPISODE_KEY.test(key) ? key : null;
}

function byUniqueTitle<T extends PairableEpisode>(episodes: readonly T[]): Map<string, T> {
  const unique = new Map<string, T>();
  const repeated = new Set<string>();
  for (const episode of episodes) {
    const key = titleKey(episode.title);
    if (!key || repeated.has(key)) continue;
    if (unique.delete(key)) repeated.add(key);
    else unique.set(key, episode);
  }
  return unique;
}

function pairTmdbEpisodes(
  seasonNumber: number,
  episodes: readonly PairableEpisode[],
  tmdb: TmdbSeasonEpisodes,
): Map<number, NormalizedEpisode> {
  const localized = tmdb.localized.get(seasonNumber) ?? [];
  const localizedByNumber = new Map(localized.map((episode) => [episode.number, episode]));
  const pairs = new Map<number, NormalizedEpisode>();

  if (episodes.length === localized.length) {
    for (const episode of episodes) {
      const match = localizedByNumber.get(episode.number);
      if (match) pairs.set(episode.number, match);
    }
    return pairs;
  }

  const englishByTitle = byUniqueTitle(tmdb.english.get(seasonNumber) ?? []);
  for (const [key, episode] of byUniqueTitle(episodes)) {
    const english = englishByTitle.get(key);
    const match = english && localizedByNumber.get(english.number);
    if (match) pairs.set(episode.number, match);
  }
  return pairs;
}

function withTmdbDetails<Title extends string | null>(
  episode: MergeableEpisode<Title>,
  tmdb: NormalizedEpisode,
): EpisodeDetails & { title: string | Title } {
  return {
    title: pickUkrainianEpisodeTitle(tmdb.title) ?? episode.title,
    overview: pickUkrainianText(tmdb.overview) ?? episode.overview ?? null,
    airDate: episode.airDate ?? tmdb.airDate ?? null,
    runtime: episode.runtime ?? tmdb.runtime ?? null,
    stillPath: episode.stillPath ?? tmdb.stillPath ?? null,
    rating: episode.rating ?? tmdb.rating ?? null,
  };
}

function isFromTvMaze(episode: NormalizedEpisode): boolean {
  return episode.tmdbId === undefined;
}

export function tvMazeEpisodeCounts(seasons: readonly NormalizedSeason[]): Map<number, number> {
  return new Map(
    seasons
      .filter((season) => season.number > SPECIALS_SEASON && season.episodes.some(isFromTvMaze))
      .map((season) => [season.number, season.episodes.length]),
  );
}

export function storedEpisodeCounts(
  stored: readonly StoredEpisode[],
  seasonNumbers: readonly number[],
): Map<number, number> {
  const counts = new Map(seasonNumbers.map((season) => [season, 0]));
  for (const { seasonNumber } of stored) {
    const count = counts.get(seasonNumber);
    if (count !== undefined) counts.set(seasonNumber, count + 1);
  }
  return counts;
}

export function renumberedSeasons(
  episodeCounts: ReadonlyMap<number, number>,
  localized: EpisodesBySeason,
): number[] {
  return [...episodeCounts]
    .filter(([season, count]) => {
      const tmdbCount = localized.get(season)?.length;
      return tmdbCount !== undefined && tmdbCount !== count;
    })
    .map(([season]) => season);
}

export function mergeTmdbEpisodeDetails(
  seasons: readonly NormalizedSeason[],
  tmdb: TmdbSeasonEpisodes,
): NormalizedSeason[] {
  return seasons.map((season) => {
    const pairs = pairTmdbEpisodes(season.number, season.episodes, tmdb);
    if (pairs.size === 0) return season;

    return {
      ...season,
      episodes: season.episodes.map((episode) => {
        const tmdb = pairs.get(episode.number);
        return tmdb ? { ...episode, ...withTmdbDetails(episode, tmdb) } : episode;
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

export function needsTmdbDetails(episode: EpisodeDetails): boolean {
  return (
    pickUkrainianEpisodeTitle(episode.title) === null ||
    pickUkrainianText(episode.overview) === null ||
    episode.airDate === null ||
    episode.runtime === null ||
    episode.stillPath === null ||
    episode.rating === null
  );
}

export function seasonsMissingDetails(stored: readonly StoredEpisode[]): number[] {
  const seasons = stored.filter(needsTmdbDetails).map((episode) => episode.seasonNumber);
  return [...new Set(seasons)].sort((a, b) => a - b);
}

function detailsOf(episode: StoredEpisode): EpisodeDetails {
  const { title, overview, airDate, runtime, stillPath, rating } = episode;
  return { title, overview, airDate, runtime, stillPath, rating };
}

function sameDetails(a: EpisodeDetails, b: EpisodeDetails): boolean {
  return (
    a.title === b.title &&
    a.overview === b.overview &&
    a.airDate?.getTime() === b.airDate?.getTime() &&
    a.runtime === b.runtime &&
    a.stillPath === b.stillPath &&
    a.rating === b.rating
  );
}

function groupBySeason(stored: readonly StoredEpisode[]): Map<number, StoredEpisode[]> {
  const bySeason = new Map<number, StoredEpisode[]>();
  for (const episode of stored) {
    const season = bySeason.get(episode.seasonNumber);
    if (season) season.push(episode);
    else bySeason.set(episode.seasonNumber, [episode]);
  }
  return bySeason;
}

export function episodeDetailsUpdates(
  stored: readonly StoredEpisode[],
  tmdb: TmdbSeasonEpisodes,
): EpisodeDetailsUpdate[] {
  return [...groupBySeason(stored)].flatMap(([seasonNumber, episodes]) => {
    const pairs = pairTmdbEpisodes(seasonNumber, episodes, tmdb);
    return episodes.flatMap((episode) => {
      const tmdb = pairs.get(episode.number);
      if (!tmdb) return [];
      const previous = detailsOf(episode);
      const next = withTmdbDetails(episode, tmdb);
      return sameDetails(previous, next) ? [] : [{ id: episode.id, next, previous }];
    });
  });
}
