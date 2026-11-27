import { pickUkrainianEpisodeTitle, pickUkrainianText } from '@/modules/shared/episode-text';

import { FILLED_ONCE_AIRED } from './constants/episode-details.constants';
import { pairTmdbEpisodes } from './episode-pairing';
import { withTmdbDetails } from './episode-sync-merge';
import {
  type EpisodeDetails,
  type EpisodeDetailsUpdate,
  type StoredEpisode,
} from './models/episode-details.model';
import { type TmdbSeasonEpisodes, type TvMazeEpisodeText } from './models/episode-sources.model';

function hasAired(episode: EpisodeDetails, nowMs: number): boolean {
  return episode.airDate !== null && episode.airDate.getTime() <= nowMs;
}

export function needsTmdbDetails(episode: EpisodeDetails, nowMs: number): boolean {
  return (
    pickUkrainianEpisodeTitle(episode.title) === null ||
    pickUkrainianText(episode.overview) === null ||
    episode.airDate === null ||
    (hasAired(episode, nowMs) && FILLED_ONCE_AIRED.some((field) => episode[field] === null))
  );
}

export function seasonsMissingDetails(stored: readonly StoredEpisode[], nowMs: number): number[] {
  const seasons = stored
    .filter((episode) => needsTmdbDetails(episode, nowMs))
    .map((episode) => episode.seasonNumber);
  return [...new Set(seasons)].sort((a, b) => a - b);
}

export function seasonsWithUkrainianTitles(stored: readonly StoredEpisode[]): number[] {
  const seasons = stored
    .filter((episode) => pickUkrainianEpisodeTitle(episode.title) !== null)
    .map((episode) => episode.seasonNumber);
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

function changeOf(episode: StoredEpisode, next: EpisodeDetails): EpisodeDetailsUpdate[] {
  const previous = detailsOf(episode);
  return sameDetails(previous, next) ? [] : [{ id: episode.id, next, previous }];
}

function groupBySeason<T extends { seasonNumber: number }>(
  episodes: readonly T[],
): Map<number, T[]> {
  const bySeason = new Map<number, T[]>();
  for (const episode of episodes) {
    const season = bySeason.get(episode.seasonNumber);
    if (season) season.push(episode);
    else bySeason.set(episode.seasonNumber, [episode]);
  }
  return bySeason;
}

export function episodeDetailsUpdates(
  stored: readonly StoredEpisode[],
  tmdb: TmdbSeasonEpisodes,
  nowMs: number,
): EpisodeDetailsUpdate[] {
  return [...groupBySeason(stored)].flatMap(([seasonNumber, episodes]) => {
    const pairs = pairTmdbEpisodes(seasonNumber, episodes, tmdb);
    return episodes.flatMap((episode) => {
      const twin = pairs.get(episode.number);
      return twin ? changeOf(episode, withTmdbDetails(episode, twin, nowMs)) : [];
    });
  });
}

export function renumberedTitleRepairs(
  stored: readonly StoredEpisode[],
  tvMazeEpisodes: readonly TvMazeEpisodeText[],
  tmdb: TmdbSeasonEpisodes,
  renumbered: readonly number[],
): EpisodeDetailsUpdate[] {
  const storedBySeason = groupBySeason(stored);
  const tvMazeBySeason = groupBySeason(tvMazeEpisodes);

  return renumbered.flatMap((seasonNumber) => {
    const tvMaze = tvMazeBySeason.get(seasonNumber) ?? [];
    const tvMazeByNumber = new Map(tvMaze.map((episode) => [episode.number, episode]));
    const pairs = pairTmdbEpisodes(seasonNumber, tvMaze, tmdb);

    return (storedBySeason.get(seasonNumber) ?? []).flatMap((episode) => {
      const source = tvMazeByNumber.get(episode.number);
      if (!source) return [];
      const twin = pairs.get(episode.number);
      return changeOf(episode, {
        ...detailsOf(episode),
        title: pickUkrainianEpisodeTitle(twin?.title) ?? source.title,
        overview: pickUkrainianText(twin?.overview) ?? source.overview ?? null,
      });
    });
  });
}
