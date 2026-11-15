import { pluralize } from '@ratingo/web-core/lib';
import { SERVICE_TIME_ZONE } from '@/shared/config';
import { interpolate, type Dictionary, type Locale } from '@/shared/i18n';
import type { Episode, Season } from './season';

const airDateFormats = new Map<Locale, Intl.DateTimeFormat>();

function airDateFormat(locale: Locale): Intl.DateTimeFormat {
  let format = airDateFormats.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      timeZone: SERVICE_TIME_ZONE,
    });
    airDateFormats.set(locale, format);
  }
  return format;
}

export function formatAirDate(locale: Locale, airDate: string): string | undefined {
  const date = new Date(airDate);
  return Number.isNaN(date.getTime()) ? undefined : airDateFormat(locale).format(date);
}

export function countEpisodes(count: number, dict: Dictionary, locale: Locale): string {
  return interpolate(pluralize(count, dict.details.episodes, locale), { count });
}

export function episodeTitle(episode: Episode, dict: Dictionary): string {
  return episode.title ?? interpolate(dict.episodes.untitled, { number: episode.number });
}

type EpisodeNumbers = Pick<Episode, 'seasonNumber' | 'number'>;

export function episodeCode(episode: EpisodeNumbers, dict: Dictionary): string {
  return interpolate(dict.episodes.episodeCode, {
    season: episode.seasonNumber,
    episode: episode.number,
  });
}

export function episodeShortCode(episode: EpisodeNumbers, dict: Dictionary): string {
  return interpolate(dict.episodes.episodeShort, { episode: episode.number });
}

export function seasonName(season: Season, dict: Dictionary): string {
  return season.name ?? interpolate(dict.episodes.season, { number: season.number });
}

export function episodeMeta(
  episode: Episode,
  isAired: boolean,
  dict: Dictionary,
  locale: Locale,
): string {
  const date = !isAired && episode.airDate ? formatAirDate(locale, episode.airDate) : undefined;
  const runtime =
    episode.runtimeMinutes === undefined
      ? undefined
      : interpolate(dict.details.runtime.minutes, { minutes: episode.runtimeMinutes });
  return [date, runtime].filter(Boolean).join(' · ');
}

export function typicalRuntime(seasons: readonly Season[]): number | undefined {
  const runtimes = seasons
    .flatMap((season) => season.episodes)
    .flatMap((episode) => (episode.runtimeMinutes === undefined ? [] : [episode.runtimeMinutes]))
    .sort((left, right) => left - right);
  return runtimes.length === 0 ? undefined : runtimes[Math.floor(runtimes.length / 2)];
}
