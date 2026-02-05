import type { CalendarEpisode } from '../../domain/repositories/show.repository.interface';

/**
 * A single day in the calendar with its episodes.
 */
export interface CalendarDay {
  date: string;
  episodes: CalendarEpisode[];
}

/**
 * Groups calendar episodes by their air date.
 * Returns days sorted chronologically with episodes for each day.
 *
 * @param episodes - Episodes to group by date
 * @returns Array of calendar days sorted by date
 */
export function groupEpisodesByDate(episodes: CalendarEpisode[]): CalendarDay[] {
  const map = new Map<string, CalendarEpisode[]>();

  for (const ep of episodes) {
    const dateKey = ep.airDate.toISOString().split('T')[0];
    if (!map.has(dateKey)) map.set(dateKey, []);
    map.get(dateKey)!.push(ep);
  }

  return Array.from(map.keys())
    .sort()
    .map((date) => ({ date, episodes: map.get(date)! }));
}
