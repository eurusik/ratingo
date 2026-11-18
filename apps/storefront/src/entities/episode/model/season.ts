import type { ShowSeason } from '@/shared/api';
import { positiveNumber } from '@/shared/lib';

export interface Episode {
  id?: string;
  seasonNumber: number;
  number: number;
  title?: string;
  airDate?: string;
  runtimeMinutes?: number;
  rating?: number;
  stillPath?: string;
}

export type TrackableEpisode = Episode & { id: string };

export interface Season {
  number: number;
  name?: string;
  episodes: Episode[];
}

type ShowEpisode = NonNullable<ShowSeason['episodes']>[number];

function byNumber(left: { number: number }, right: { number: number }): number {
  return left.number - right.number;
}

const PLACEHOLDER_TITLES = new Set(['tba', 'tbd']);

function announcedTitle(title: string | null | undefined): string | undefined {
  const trimmed = title?.trim();
  return trimmed && !PLACEHOLDER_TITLES.has(trimmed.toLowerCase()) ? trimmed : undefined;
}

function toEpisode(episode: ShowEpisode, seasonNumber: number): Episode {
  return {
    id: episode.id ?? undefined,
    seasonNumber,
    number: episode.number,
    title: announcedTitle(episode.title),
    airDate: episode.airDate ?? undefined,
    runtimeMinutes: positiveNumber(episode.runtime),
    rating: positiveNumber(episode.voteAverage),
    stillPath: episode.stillPath ?? undefined,
  };
}

export function toSeasons(seasons: readonly ShowSeason[]): Season[] {
  return seasons
    .filter((season) => season.number > 0 && (season.episodes?.length ?? 0) > 0)
    .map((season) => ({
      number: season.number,
      name: season.name?.trim() || undefined,
      episodes: (season.episodes ?? [])
        .map((episode) => toEpisode(episode, season.number))
        .sort(byNumber),
    }))
    .sort(byNumber);
}

function airTime(episode: Episode): number | undefined {
  if (!episode.airDate) return undefined;
  const airedAt = Date.parse(episode.airDate);
  return Number.isNaN(airedAt) ? undefined : airedAt;
}

export function hasAired(episode: Episode, now: number): boolean {
  const airedAt = airTime(episode);
  return airedAt !== undefined && airedAt <= now;
}

function isUpcoming(episode: Episode, now: number): boolean {
  const airedAt = airTime(episode);
  return airedAt !== undefined && airedAt > now;
}

export function isTrackable(episode: Episode, now: number): episode is TrackableEpisode {
  return episode.id !== undefined && hasAired(episode, now);
}

export function trackableEpisodes(seasons: readonly Season[], now: number): TrackableEpisode[] {
  return seasons
    .flatMap((season) => season.episodes)
    .filter((episode) => isTrackable(episode, now));
}

export function nextUpcoming(seasons: readonly Season[], now: number): Episode | undefined {
  return seasons.flatMap((season) => season.episodes).find((episode) => isUpcoming(episode, now));
}
