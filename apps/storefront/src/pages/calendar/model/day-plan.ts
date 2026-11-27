import type { CalendarEpisode } from '@/shared/api';
import { kyivDateKey } from './calendar-dates';
import type { CalendarMode } from './calendar-query';

const VISIBLE_SHOWS_PER_DAY = 3;
const PREMIERE_EPISODE_NUMBER = 1;
const SPECIALS_SEASON_NUMBER = 0;
const FIRST_SEASON_NUMBER = 1;

export interface DayPlan {
  visible: CalendarEpisode[];
  hidden: CalendarEpisode[];
  hiddenShows: number;
}

export type EpisodeMark = 'newSeries' | 'newSeason' | 'finale';

export type EpisodeAction = 'watch' | 'remind' | 'start' | 'save' | 'none';

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

function isSeasonPremiere(episode: CalendarEpisode): boolean {
  return (
    episode.seasonNumber > SPECIALS_SEASON_NUMBER &&
    episode.episodeNumber === PREMIERE_EPISODE_NUMBER
  );
}

function isSeriesPremiere(episode: CalendarEpisode): boolean {
  return isSeasonPremiere(episode) && episode.seasonNumber === FIRST_SEASON_NUMBER;
}

function firstPerShow(episodes: readonly CalendarEpisode[]): CalendarEpisode[] {
  const seen = new Set<string>();
  return episodes.filter((episode) => {
    if (seen.has(episode.showId)) return false;
    seen.add(episode.showId);
    return true;
  });
}

function newSeriesFirst(left: CalendarEpisode, right: CalendarEpisode): number {
  return Number(isSeriesPremiere(right)) - Number(isSeriesPremiere(left));
}

function planPremieres(episodes: readonly CalendarEpisode[]): DayPlan {
  const premieres = firstPerShow(episodes.filter(isSeasonPremiere)).sort(newSeriesFirst);
  return { visible: premieres, hidden: [], hiddenShows: 0 };
}

export function planDay(episodes: readonly CalendarEpisode[], mode: CalendarMode): DayPlan {
  if (mode === 'mine') return { visible: [...episodes], hidden: [], hiddenShows: 0 };
  if (mode === 'premieres') return planPremieres(episodes);
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
  if (isSeriesPremiere(episode)) return 'newSeries';
  if (isSeasonPremiere(episode)) return 'newSeason';
  if (episode.seasonEpisodeCount === episode.episodeNumber) return 'finale';
  return undefined;
}

function hasAired(episode: CalendarEpisode, now: number): boolean {
  if (episode.airDateDayOnly) return kyivDateKey(episode.airDate) <= kyivDateKey(new Date(now));
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
    return hasAired(episode, now) ? 'watch' : 'remind';
  }
  if (isSeriesPremiere(episode) && !hasAired(episode, now)) return 'save';
  return mode !== 'mine' || episode.isSaved ? 'start' : 'none';
}
