import type { CalendarEpisode, CalendarRange } from '@/shared/api';

export function hasTrackedShows(range: CalendarRange | undefined): boolean {
  return (range?.watchingShowsCount ?? 0) > 0;
}

function mapEpisodes(
  range: CalendarRange,
  update: (episode: CalendarEpisode) => CalendarEpisode,
): CalendarRange {
  return {
    ...range,
    days: range.days.map((day) => ({ ...day, episodes: day.episodes.map(update) })),
  };
}

export function withWatched(
  range: CalendarRange,
  episodeId: string,
  isWatched: boolean,
): CalendarRange {
  return mapEpisodes(range, (episode) =>
    episode.episodeId === episodeId ? { ...episode, isWatched } : episode,
  );
}

export function withTracked(range: CalendarRange, showId: string): CalendarRange {
  return mapEpisodes(range, (episode) =>
    episode.showId === showId ? { ...episode, isTracked: true } : episode,
  );
}
