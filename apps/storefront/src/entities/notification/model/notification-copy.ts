import type { NotificationItem, NotificationTrigger } from '@/shared/api';
import type { Dictionary } from '@/shared/i18n';
import { interpolate } from '@/shared/i18n';

export type NotificationTone = 'accent' | 'success' | 'warning' | 'default';

const KIND_TONES: Record<NotificationTrigger, NotificationTone> = {
  new_episode: 'accent',
  new_season: 'success',
  release: 'warning',
  on_streaming: 'warning',
  status_changed: 'default',
  premiere: 'warning',
};

export function notificationTone(trigger: NotificationTrigger): NotificationTone {
  return KIND_TONES[trigger];
}

function seasonOf(item: NotificationItem): number | undefined {
  return item.payload?.seasonNumber ?? undefined;
}

type NotificationTexts = Dictionary['notifications']['text'];

const EPISODE_KEY = /^S(\d+)E(\d+)$/i;
const FIRST_EPISODE_NUMBER = 1;

type EpisodeNumbers = Record<'season' | 'episode', number>;

function parseEpisodeKey(episodeKey: string | undefined): EpisodeNumbers | undefined {
  const match = episodeKey ? EPISODE_KEY.exec(episodeKey) : null;
  return match ? { season: Number(match[1]), episode: Number(match[2]) } : undefined;
}

function premiereText(item: NotificationItem, text: NotificationTexts, title: string): string {
  const last = parseEpisodeKey(item.payload?.episodeKey)?.episode;
  if (last === undefined || last <= FIRST_EPISODE_NUMBER) return interpolate(text.premiere, { title });
  return interpolate(text.premiere_batch, { title, last });
}

function episodeLabel(episodeKey: string | undefined, dict: Dictionary): string {
  const numbers = parseEpisodeKey(episodeKey);
  return numbers ? interpolate(dict.episodes.episodeCode, numbers) : (episodeKey ?? '');
}

const HOME_COUNTRY = 'UA';
const US_COUNTRY = 'US';

function releaseTemplate(item: NotificationItem, text: NotificationTexts): string {
  const kind = item.payload?.releaseKind;
  const country = item.payload?.releaseCountry;
  const isDigital = kind ? kind === 'digital' : item.trigger === 'on_streaming';
  if (isDigital) return country === US_COUNTRY ? text.on_streaming_us : text.on_streaming;
  if (!kind || country === HOME_COUNTRY) return text.release;
  return country === US_COUNTRY ? text.release_us : text.release_world;
}

export function notificationText(item: NotificationItem, dict: Dictionary): string {
  const { text } = dict.notifications;
  const title = item.mediaSummary.title;
  if (item.trigger === 'release' || item.trigger === 'on_streaming') {
    return interpolate(releaseTemplate(item, text), { title });
  }
  if (item.trigger === 'new_season') {
    const season = seasonOf(item);
    return season === undefined
      ? interpolate(text.new_season_unknown, { title })
      : interpolate(text.new_season, { title, season });
  }
  if (item.trigger === 'premiere') return premiereText(item, text, title);
  if (item.trigger === 'status_changed' && item.mediaSummary.type === 'show') {
    return interpolate(text.status_changed_show, { title });
  }
  if (item.trigger === 'new_episode') {
    return interpolate(text.new_episode, {
      title,
      code: episodeLabel(item.payload?.episodeKey, dict),
    });
  }
  return interpolate(text[item.trigger], { title });
}

function formatDay(locale: string, isoDate: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(
    new Date(isoDate),
  );
}

export function notificationDetail(
  item: NotificationItem,
  dict: Dictionary,
  locale: string,
): string | undefined {
  const { sub } = dict.notifications;
  if (item.trigger === 'release' || item.trigger === 'on_streaming') return sub.fromPlan;
  if (item.trigger === 'status_changed') {
    const airDate = item.payload?.airDate;
    if (!airDate) return sub.remind;
    const template = item.mediaSummary.type === 'show' ? sub.premiereDate : sub.airDate;
    return interpolate(template, { date: formatDay(locale, airDate) });
  }
  return undefined;
}
