import { useQuery } from '@tanstack/react-query';
import { catalogApi, type EpisodeOverview } from '@/shared/api';
import type { Episode } from './season';

const OVERVIEWS_STALE_MS = 60 * 60 * 1000;

function byEpisodeNumber(overviews: EpisodeOverview[]): ReadonlyMap<number, EpisodeOverview> {
  return new Map(overviews.map((overview) => [overview.number, overview]));
}

export interface EpisodeOverviewState {
  overview?: EpisodeOverview;
  isLoading: boolean;
  isFailed: boolean;
}

export function useEpisodeOverview(showSlug: string, episode: Episode): EpisodeOverviewState {
  const { data, isPending, isError } = useQuery({
    queryKey: ['catalog', 'season-overviews', showSlug, episode.seasonNumber] as const,
    queryFn: ({ signal }) => catalogApi.getSeasonOverviews(showSlug, episode.seasonNumber, signal),
    staleTime: OVERVIEWS_STALE_MS,
    select: byEpisodeNumber,
  });
  return { overview: data?.get(episode.number), isLoading: isPending, isFailed: isError };
}

function comesAfter(episode: Episode, other: Episode): boolean {
  if (episode.seasonNumber !== other.seasonNumber) return episode.seasonNumber > other.seasonNumber;
  return episode.number > other.number;
}

export function isOverviewSpoiler(
  episode: Episode,
  watched: ReadonlySet<string>,
  nextToWatch: Episode | undefined,
): boolean {
  if (watched.size === 0 || !nextToWatch) return false;
  if (episode.id !== undefined && watched.has(episode.id)) return false;
  return comesAfter(episode, nextToWatch);
}
