import { pickUkrainianEpisodeTitle, pickUkrainianText } from '@/modules/shared/episode-text';

import { type EpisodeTextUpdate, type StoredEpisodeText } from './models/episode-text.model';
import { type NormalizedEpisode, type NormalizedSeason } from './models/normalized-media.model';

const SPECIALS_SEASON = 0;

type EpisodeTranslations = ReadonlyMap<number, readonly NormalizedEpisode[]>;

interface UkrainianTexts {
  title: string | null;
  overview: string | null;
}

function ukrainianTextsByNumber(
  translations: readonly NormalizedEpisode[] = [],
): Map<number, UkrainianTexts> {
  return new Map(
    translations.map((translation) => [
      translation.number,
      {
        title: pickUkrainianEpisodeTitle(translation.title),
        overview: pickUkrainianText(translation.overview),
      },
    ]),
  );
}

function isFromTvMaze(episode: NormalizedEpisode): boolean {
  return episode.tmdbId === undefined;
}

export function tvMazeSeasonNumbers(seasons: readonly NormalizedSeason[]): number[] {
  return seasons
    .filter((season) => season.number > SPECIALS_SEASON && season.episodes.some(isFromTvMaze))
    .map((season) => season.number);
}

export function localizeSeasons(
  seasons: readonly NormalizedSeason[],
  translations: EpisodeTranslations,
): NormalizedSeason[] {
  return seasons.map((season) => {
    const texts = ukrainianTextsByNumber(translations.get(season.number));
    if (texts.size === 0) return season;

    return {
      ...season,
      episodes: season.episodes.map((episode) => {
        const text = texts.get(episode.number);
        if (!text?.title && !text?.overview) return episode;
        return {
          ...episode,
          title: text.title ?? episode.title,
          overview: text.overview ?? episode.overview,
        };
      }),
    };
  });
}

export function seasonsMissingUkrainianTitles(stored: readonly StoredEpisodeText[]): number[] {
  const seasons = stored
    .filter((episode) => pickUkrainianEpisodeTitle(episode.title) === null)
    .map((episode) => episode.seasonNumber);
  return [...new Set(seasons)].sort((a, b) => a - b);
}

export function episodeTextUpdates(
  stored: readonly StoredEpisodeText[],
  translations: EpisodeTranslations,
): EpisodeTextUpdate[] {
  const textsBySeason = new Map(
    [...translations].map(([season, episodes]) => [season, ukrainianTextsByNumber(episodes)]),
  );

  return stored.flatMap((episode) => {
    const text = textsBySeason.get(episode.seasonNumber)?.get(episode.number);
    const title = text?.title ?? episode.title;
    const overview = text?.overview ?? episode.overview;
    if (title === episode.title && overview === episode.overview) return [];
    return [
      {
        id: episode.id,
        title,
        overview,
        previousTitle: episode.title,
        previousOverview: episode.overview,
      },
    ];
  });
}
