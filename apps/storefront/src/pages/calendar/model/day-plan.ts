import type { CalendarEpisode } from '@/shared/api';
import type { CalendarMode } from './calendar-query';

const VISIBLE_SHOWS_PER_DAY = 3;
const PREMIERE_EPISODE_NUMBER = 1;
const SPECIALS_SEASON_NUMBER = 0;

export interface DayPlan {
  visible: CalendarEpisode[];
  hidden: CalendarEpisode[];
  hiddenShows: number;
}

export type EpisodeMark = 'premiere' | 'finale';

export type EpisodeAction = 'watch' | 'start' | 'none';

export type ViewerStatus = 'resolving' | 'guest' | 'signedIn';

function groupByShow(episodes: readonly CalendarEpisode[]): CalendarEpisode[][] {
  const shows = new Map<string, CalendarEpisode[]>();
  for (const episode of episodes) {
    const show = shows.get(episode.showId);
    if (show) show.push(episode);
    else shows.set(episode.showId, [episode]);
  }
  return [...shows.values()].sort(
    (left, right) => right[0].showPopularity - left[0].showPopularity,
  );
}

function isViewersShow(show: readonly CalendarEpisode[]): boolean {
  return show.some((episode) => episode.isTracked || episode.isSaved);
}

export function planDay(episodes: readonly CalendarEpisode[], mode: CalendarMode): DayPlan {
  if (mode === 'mine') return { visible: [...episodes], hidden: [], hiddenShows: 0 };
  const shows = groupByShow(episodes);
  const isVisible = (show: CalendarEpisode[], rank: number) =>
    rank < VISIBLE_SHOWS_PER_DAY || isViewersShow(show);
  const hiddenShows = shows.filter((show, rank) => !isVisible(show, rank));
  return {
    visible: shows.filter(isVisible).flat(),
    hidden: hiddenShows.flat(),
    hiddenShows: hiddenShows.length,
  };
}

export function episodeMark(episode: CalendarEpisode): EpisodeMark | undefined {
  if (episode.seasonNumber === SPECIALS_SEASON_NUMBER) return undefined;
  if (episode.episodeNumber === PREMIERE_EPISODE_NUMBER) return 'premiere';
  if (episode.seasonEpisodeCount === episode.episodeNumber) return 'finale';
  return undefined;
}

function hasAired(episode: CalendarEpisode, now: number): boolean {
  return Date.parse(episode.airDate) <= now;
}

interface ActionContext {
  mode: CalendarMode;
  now: number;
  viewer: ViewerStatus;
}

export function episodeAction(
  episode: CalendarEpisode,
  { mode, now, viewer }: ActionContext,
): EpisodeAction {
  if (viewer === 'resolving') return 'none';
  if (viewer === 'signedIn' && episode.isTracked) {
    return hasAired(episode, now) ? 'watch' : 'none';
  }
  return mode === 'all' || episode.isSaved ? 'start' : 'none';
}
