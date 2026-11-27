import { MS_PER_DAY } from '@/common/constants';

import {
  MAX_PAIRED_AIR_DATE_GAP_DAYS,
  SPECIALS_SEASON_NUMBER,
} from './constants/episode-details.constants';
import { type StoredEpisode } from './models/episode-details.model';
import {
  type EpisodesBySeason,
  type PairableEpisode,
  type TmdbSeasonEpisodes,
} from './models/episode-sources.model';
import { type NormalizedEpisode, type NormalizedSeason } from './models/normalized-media.model';

const PARENTHESES = /\([^)]*\)/g;
const LEADING_ARTICLE = /^\s*the\s+/;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]/gu;
const NUMBERED_EPISODE_KEY = /^episode\d+$/;
const MAX_PAIRED_AIR_DATE_GAP_MS = MAX_PAIRED_AIR_DATE_GAP_DAYS * MS_PER_DAY;

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

function airDatesConflict(ours?: Date | null, tmdb?: Date | null): boolean {
  if (!ours || !tmdb) return false;
  return Math.abs(ours.getTime() - tmdb.getTime()) > MAX_PAIRED_AIR_DATE_GAP_MS;
}

export function pairTmdbEpisodes(
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
      if (match && !airDatesConflict(episode.airDate, match.airDate)) {
        pairs.set(episode.number, match);
      }
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

function isFromTvMaze(episode: NormalizedEpisode): boolean {
  return episode.tmdbId === undefined;
}

export function tvMazeEpisodeCounts(seasons: readonly NormalizedSeason[]): Map<number, number> {
  return new Map(
    seasons
      .filter(
        (season) => season.number > SPECIALS_SEASON_NUMBER && season.episodes.some(isFromTvMaze),
      )
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
