import { episodeCode } from '@/entities/episode';
import type { CalendarEpisode } from '@/shared/api';
import { interpolate, type Dictionary, type Locale } from '@/shared/i18n';
import { kyivHour } from './calendar-dates';
import { formatReleaseTime } from './calendar-format';

const MORNING_ENDS_AT_HOUR = 7;
const NUMBERED_EPISODE_WORDS = ['episode', 'серія', 'эпизод'];
const PLACEHOLDER_TITLE = new RegExp(
  `^(?:${NUMBERED_EPISODE_WORDS.join('|')})\\s+\\d+$|^tb[ad]$`,
  'i',
);

export function isMorningRelease(instant: string): boolean {
  return kyivHour(instant) < MORNING_ENDS_AT_HOUR;
}

export function meaningfulTitle(title: string | null): string | undefined {
  const trimmed = title?.trim();
  return trimmed && !PLACEHOLDER_TITLE.test(trimmed) ? trimmed : undefined;
}

export function calendarEpisodeCode(episode: CalendarEpisode, dict: Dictionary): string {
  return episodeCode({ seasonNumber: episode.seasonNumber, number: episode.episodeNumber }, dict);
}

function releaseTime(
  episode: CalendarEpisode,
  dict: Dictionary,
  locale: Locale,
): string | undefined {
  if (episode.airDateDayOnly) return undefined;
  return isMorningRelease(episode.airDate)
    ? dict.calendar.morning
    : formatReleaseTime(locale, episode.airDate);
}

export function episodeLine(episode: CalendarEpisode, dict: Dictionary, locale: Locale): string {
  const title = meaningfulTitle(episode.title);
  const quoted = title && interpolate(dict.calendar.quotedTitle, { title });
  const runtime = episode.runtime
    ? interpolate(dict.calendar.minutes, { minutes: episode.runtime })
    : undefined;
  const savedNote = episode.isSaved && !episode.isTracked ? dict.calendar.savedNote : undefined;
  return [releaseTime(episode, dict, locale), quoted, runtime, savedNote]
    .filter(Boolean)
    .join(' · ');
}
