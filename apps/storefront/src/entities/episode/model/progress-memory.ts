import type { ShowProgress } from '@/shared/api';

const STORAGE_KEY = 'ratingo:watched-counts:v1';
const MAX_REMEMBERED_SHOWS = 20;

interface RememberedShow {
  showId: string;
  watchedCount: number;
}

interface RememberedCounts {
  userId: string;
  shows: RememberedShow[];
}

function isRememberedShow(value: unknown): value is RememberedShow {
  if (typeof value !== 'object' || value === null) return false;
  const show = value as Record<string, unknown>;
  return typeof show.showId === 'string' && typeof show.watchedCount === 'number';
}

export function parseRememberedCounts(raw: string | null): RememberedCounts | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const { userId, shows } = parsed as Record<string, unknown>;
    if (typeof userId !== 'string' || !Array.isArray(shows)) return undefined;
    return { userId, shows: shows.filter(isRememberedShow).slice(0, MAX_REMEMBERED_SHOWS) };
  } catch {
    return undefined;
  }
}

let lastRead: { raw: string | null; counts: RememberedCounts | undefined } | undefined;

function readCounts(): RememberedCounts | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (lastRead?.raw !== raw) lastRead = { raw, counts: parseRememberedCounts(raw) };
    return lastRead.counts;
  } catch {
    return undefined;
  }
}

function writeCounts(counts: RememberedCounts): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
  }
}

export function withRememberedCount(
  counts: RememberedCounts | undefined,
  userId: string,
  show: RememberedShow,
): RememberedCounts {
  const others =
    counts?.userId === userId
      ? counts.shows.filter((candidate) => candidate.showId !== show.showId)
      : [];
  return { userId, shows: [show, ...others].slice(0, MAX_REMEMBERED_SHOWS) };
}

function watchedCountOf(progress: ShowProgress): number {
  return progress.seasons.reduce((total, season) => total + season.watchedEpisodeIds.length, 0);
}

function isLatest(counts: RememberedCounts | undefined, userId: string, show: RememberedShow) {
  const latest = counts?.shows[0];
  return (
    counts?.userId === userId &&
    latest?.showId === show.showId &&
    latest.watchedCount === show.watchedCount
  );
}

export function rememberProgress(userId: string, showId: string, progress: ShowProgress): void {
  const counts = readCounts();
  const show = { showId, watchedCount: watchedCountOf(progress) };
  if (!isLatest(counts, userId, show)) writeCounts(withRememberedCount(counts, userId, show));
}

export function recallWatchedCount(showId: string): number {
  return readCounts()?.shows.find((show) => show.showId === showId)?.watchedCount ?? 0;
}
