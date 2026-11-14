import { isSeasonDone, seasonProgress, type Season } from '@/entities/episode';

export function isSeasonComplete(season: Season, watched: ReadonlySet<string>, now: number) {
  return isSeasonDone(seasonProgress(season, watched, now));
}

export function isBehind(
  seasons: readonly Season[],
  season: Season,
  watched: ReadonlySet<string>,
  now: number,
): boolean {
  const current = seasonProgress(season, watched, now);
  if (current.aired === 0) return false;
  const hasUnfinishedEarlier = seasons.some(
    (candidate) =>
      candidate.number < season.number &&
      seasonProgress(candidate, watched, now).aired > 0 &&
      !isSeasonComplete(candidate, watched, now),
  );
  return current.watched === 0 || hasUnfinishedEarlier;
}
