import type { CalendarEpisode, CalendarRange, UserMediaState } from '@/shared/api';
import { titleOf, titleOfEpisode, type LibraryTitle } from './library-title';

export interface NextEpisode {
  episodeId?: string;
  seasonNumber: number;
  episodeNumber: number;
  airDate?: string;
}

export interface FreshRow {
  kind: 'fresh';
  title: LibraryTitle;
  episode: NextEpisode & { episodeId: string };
  showRecordId: string;
  isNewSeason: boolean;
}

export interface NextRow {
  kind: 'next';
  title: LibraryTitle;
  episode?: NextEpisode;
  watched: number;
  total: number;
}

export interface WaitingRow {
  kind: 'waiting';
  title: LibraryTitle;
  episode?: NextEpisode;
}

export interface WatchingSections {
  fresh: FreshRow[];
  next: NextRow[];
  waiting: WaitingRow[];
}

const PREMIERE_EPISODE = 1;

function isAired(airDate: string | null | undefined, now: number): boolean {
  if (!airDate) return false;
  const airedAt = Date.parse(airDate);
  return Number.isFinite(airedAt) && airedAt <= now;
}

function earliestUnwatchedByShow(
  range: CalendarRange | undefined,
  now: number,
): Map<string, CalendarEpisode> {
  const byShow = new Map<string, CalendarEpisode>();
  const episodes = range?.days.flatMap((day) => day.episodes) ?? [];
  for (const episode of episodes) {
    if (!episode.isTracked || episode.isWatched || !isAired(episode.airDate, now)) continue;
    if (!byShow.has(episode.showId)) byShow.set(episode.showId, episode);
  }
  return byShow;
}

function freshRow(episode: CalendarEpisode): FreshRow {
  return {
    kind: 'fresh',
    title: titleOfEpisode(episode),
    showRecordId: episode.showRecordId,
    isNewSeason: episode.episodeNumber === PREMIERE_EPISODE,
    episode: {
      episodeId: episode.episodeId,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      airDate: episode.airDate,
    },
  };
}

function nextEpisodeOf(item: UserMediaState): NextEpisode | undefined {
  const point = item.continuePoint;
  if (!point) return undefined;
  return {
    episodeId: point.episodeId,
    seasonNumber: point.season,
    episodeNumber: point.episode,
    airDate: point.airDate ?? undefined,
  };
}

function libraryTitle(item: UserMediaState): LibraryTitle | undefined {
  return item.mediaSummary ? titleOf(item.mediaItemId, item.mediaSummary) : undefined;
}

export function splitWatching(
  watching: readonly UserMediaState[],
  caughtUp: readonly UserMediaState[],
  recent: CalendarRange | undefined,
  now: number,
): WatchingSections {
  const freshByShow = earliestUnwatchedByShow(recent, now);
  const fresh: FreshRow[] = [];
  const next: NextRow[] = [];
  const waiting: WaitingRow[] = [];

  for (const item of [...watching, ...caughtUp]) {
    const title = libraryTitle(item);
    if (!title) continue;
    const freshEpisode = freshByShow.get(item.mediaItemId);
    if (freshEpisode) {
      fresh.push(freshRow(freshEpisode));
      continue;
    }
    const episode = nextEpisodeOf(item);
    const canContinue =
      item.state === 'watching' &&
      episode?.episodeId !== undefined &&
      isAired(episode.airDate, now);
    if (canContinue) {
      next.push({
        kind: 'next',
        title,
        episode,
        watched: item.progressSummary?.watched ?? 0,
        total: item.progressSummary?.total ?? 0,
      });
    } else {
      waiting.push({ kind: 'waiting', title, episode });
    }
  }
  return { fresh, next, waiting };
}

export function remainingEpisodes(row: NextRow): number {
  return Math.max(0, row.total - row.watched);
}
