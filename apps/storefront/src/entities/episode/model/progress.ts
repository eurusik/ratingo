import type { ShowProgress } from '@/shared/api';
import { trackableEpisodes, type Episode, type Season, type TrackableEpisode } from './season';

type SeasonProgress = ShowProgress['seasons'][number];

export interface WatchChange {
  episodeIds: readonly string[];
  watched: boolean;
}

export interface ProgressCount {
  watched: number;
  aired: number;
}

export interface ShowProgressSummary extends ProgressCount {
  next?: TrackableEpisode;
}

export function watchedEpisodeIds(progress: ShowProgress | undefined): ReadonlySet<string> {
  return new Set(progress?.seasons.flatMap((season) => season.watchedEpisodeIds) ?? []);
}

function emptySeasonProgress(season: Season): SeasonProgress {
  return {
    seasonNumber: season.number,
    watchedCount: 0,
    totalCount: season.episodes.length,
    watchedEpisodeIds: [],
  };
}

function withChange(
  current: SeasonProgress,
  season: Season,
  changed: ReadonlySet<string>,
  watched: boolean,
): SeasonProgress {
  const ids = new Set(current.watchedEpisodeIds);
  for (const episode of season.episodes) {
    if (episode.id === undefined || !changed.has(episode.id)) continue;
    if (watched) ids.add(episode.id);
    else ids.delete(episode.id);
  }
  const watchedIds = [...ids];
  return { ...current, watchedEpisodeIds: watchedIds, watchedCount: watchedIds.length };
}

function containsAny(season: Season, ids: ReadonlySet<string>): boolean {
  return season.episodes.some((episode) => episode.id !== undefined && ids.has(episode.id));
}

export function applyWatchChange(
  progress: ShowProgress,
  change: WatchChange,
  seasons: readonly Season[],
): ShowProgress {
  const changed = new Set(change.episodeIds);
  const bySeason = new Map(progress.seasons.map((season) => [season.seasonNumber, season]));

  for (const season of seasons) {
    if (!containsAny(season, changed)) continue;
    const current = bySeason.get(season.number) ?? emptySeasonProgress(season);
    bySeason.set(season.number, withChange(current, season, changed, change.watched));
  }

  const nextSeasons = [...bySeason.values()].sort(
    (left, right) => left.seasonNumber - right.seasonNumber,
  );
  return { ...progress, seasons: nextSeasons };
}

function countWatched(episodes: readonly TrackableEpisode[], watched: ReadonlySet<string>) {
  return episodes.filter((episode) => watched.has(episode.id)).length;
}

export function summarizeProgress(
  seasons: readonly Season[],
  watched: ReadonlySet<string>,
  now: number,
): ShowProgressSummary {
  const episodes = trackableEpisodes(seasons, now);
  const isUnwatched = (episode: TrackableEpisode) => !watched.has(episode.id);
  const lastWatched = episodes.findLastIndex((episode) => watched.has(episode.id));
  return {
    watched: countWatched(episodes, watched),
    aired: episodes.length,
    next: episodes.slice(lastWatched + 1).find(isUnwatched) ?? episodes.find(isUnwatched),
  };
}

export function seasonProgress(
  season: Season,
  watched: ReadonlySet<string>,
  now: number,
): ProgressCount {
  const episodes = trackableEpisodes([season], now);
  return { watched: countWatched(episodes, watched), aired: episodes.length };
}

export function isSeasonDone({ watched, aired }: ProgressCount): boolean {
  return aired > 0 && watched >= aired;
}

export function currentSeason(
  seasons: readonly Season[],
  summary: ShowProgressSummary,
  watched: ReadonlySet<string>,
  now: number,
): Season {
  const withAired = seasons.filter((season) => seasonProgress(season, watched, now).aired > 0);
  return (
    seasons.find((season) => season.number === summary.next?.seasonNumber) ??
    withAired[withAired.length - 1] ??
    seasons[seasons.length - 1]
  );
}

export function unwatchedThrough(
  seasons: readonly Season[],
  episode: Episode,
  watched: ReadonlySet<string>,
  now: number,
): string[] {
  const episodes = trackableEpisodes(seasons, now);
  const position = episodes.findIndex((candidate) => candidate.id === episode.id);
  if (position < 0) return [];
  return episodes
    .slice(0, position + 1)
    .filter((candidate) => !watched.has(candidate.id))
    .map((candidate) => candidate.id);
}

export function watchedIn(season: Season, watched: ReadonlySet<string>): string[] {
  return season.episodes.flatMap((episode) =>
    episode.id !== undefined && watched.has(episode.id) ? [episode.id] : [],
  );
}

export function unwatchedAired(
  seasons: readonly Season[],
  watched: ReadonlySet<string>,
  now: number,
): string[] {
  return trackableEpisodes(seasons, now)
    .filter((episode) => !watched.has(episode.id))
    .map((episode) => episode.id);
}
