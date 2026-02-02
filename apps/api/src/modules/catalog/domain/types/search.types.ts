import { MediaType } from '@/common/enums/media-type.enum';

/**
 * Source of the search result.
 */
export enum SearchSource {
  LOCAL = 'local',
  TMDB = 'tmdb',
}

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
  source: SearchSource.LOCAL;
  id: string;
  slug: string;
}

/**
 * TMDB search result item (from external API).
 */
export interface TmdbSearchResultItem extends BaseSearchResultItem {
  source: SearchSource.TMDB;
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
