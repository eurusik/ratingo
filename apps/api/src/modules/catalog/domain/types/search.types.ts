import { MediaType } from '@/common/enums/media-type.enum';

/**
 * Source of the search result.
 */
export const SEARCH_SOURCE = {
  LOCAL: 'local',
  TMDB: 'tmdb',
} as const;

export type SearchSource = (typeof SEARCH_SOURCE)[keyof typeof SEARCH_SOURCE];

/**
 * Base search result item (common fields).
 */
interface BaseSearchResultItem {
  source: SearchSource;
  type: MediaType;
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  year: number | null;
  posterPath: string | null;
  rating: number;
}

/**
 * Local search result item (from our database).
 */
export interface LocalSearchResultItem extends BaseSearchResultItem {
  source: typeof SEARCH_SOURCE.LOCAL;
  id: string;
  slug: string;
}

/**
 * TMDB search result item (from external API).
 */
export interface TmdbSearchResultItem extends BaseSearchResultItem {
  source: typeof SEARCH_SOURCE.TMDB;
  isImported: boolean;
}

/**
 * Union type for any search result item.
 */
export type SearchResultItem = LocalSearchResultItem | TmdbSearchResultItem;

/**
 * Combined search results from multiple sources.
 */
export interface HybridSearchResult {
  query: string;
  local: LocalSearchResultItem[];
  tmdb: TmdbSearchResultItem[];
}
