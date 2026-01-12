/**
 * Mappers for home page data transformation.
 */

import type { NewEpisodeItem } from '@/core/api/catalog';
import { tmdbImageUrl, TMDB_POSTER_SIZES } from '@/shared/constants';
import type { MediaCardServerProps, NewEpisodeShowItem } from './components';

/** API item with optional card metadata */
type ApiItem = Record<string, unknown> & {
  card?: Record<string, unknown>;
  mediaItemId?: string;
  id?: string;
  hasRecentEpisode?: boolean;
};

/** Extended card props with recent episode flag */
export type HomeCardProps = MediaCardServerProps & {
  hasRecentEpisode: boolean;
};

/** Map API item to MediaCardServerProps */
export function toCardProps(item: ApiItem, type: 'show' | 'movie'): HomeCardProps {
  const card = item.card;
  const mediaItemId = item.mediaItemId ?? (item.id as string);

  return {
    id: mediaItemId,
    slug: item.slug as string,
    type,
    title: item.title as string,
    poster: (item.poster as MediaCardServerProps['poster']) ?? undefined,
    stats: (item.stats as MediaCardServerProps['stats']) ?? undefined,
    externalRatings: (item.externalRatings as MediaCardServerProps['externalRatings']) ?? undefined,
    showProgress: (item.showProgress as MediaCardServerProps['showProgress']) ?? undefined,
    releaseDate: (item.releaseDate as string) ?? undefined,
    badgeKey: (card?.badgeKey as MediaCardServerProps['badgeKey']) ?? undefined,
    listContext: (card?.listContext as string) ?? undefined,
    hasRecentEpisode: item.hasRecentEpisode ?? false,
  };
}

/** Filter and map show cards to new episode items, sorted by airDate (newest first) */
export function extractNewEpisodeItems(showCards: HomeCardProps[]): NewEpisodeShowItem[] {
  return showCards
    .filter((card) => card.hasRecentEpisode && card.showProgress)
    .map((card) => ({
      id: card.id,
      slug: card.slug,
      title: card.title,
      posterUrl: card.poster?.medium ?? null,
      seasonNumber: card.showProgress?.season ?? null,
      episodeNumber: card.showProgress?.episode ?? null,
      airDate: card.showProgress?.lastAirDate?.toString() ?? new Date().toISOString(),
    }))
    .sort((a, b) => new Date(b.airDate).getTime() - new Date(a.airDate).getTime());
}

/**
 * Map new episodes API response to component format.
 * Handles both array and {data: []} response shapes.
 */
export function mapNewEpisodes(
  response: { data?: NewEpisodeItem[] } | NewEpisodeItem[],
): NewEpisodeShowItem[] {
  const items = Array.isArray(response) ? response : (response.data ?? []);

  return items.map((ep) => ({
    id: ep.mediaItemId,
    slug: ep.slug,
    title: ep.title,
    posterUrl: tmdbImageUrl(ep.posterPath, TMDB_POSTER_SIZES.W154),
    seasonNumber: ep.seasonNumber,
    episodeNumber: ep.episodeNumber,
    airDate: ep.airDate,
  }));
}
