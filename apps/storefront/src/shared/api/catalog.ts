import type { GetData, components } from '@ratingo/api-contract';
import { apiGet, apiPost } from '@ratingo/web-core/api';

export type SearchItem = components['schemas']['SearchItemDto'];
export type SearchResponse = components['schemas']['SearchResponseDto'];
export type MediaType = SearchItem['type'];
export type ImportResult = components['schemas']['ImportResultDto'];
export type ImportJobStatus = GetData<'/api/catalog/import/status/{jobId}'>;
export type TrendingMovie = components['schemas']['MovieListItemDto'];
export type TrendingShow = components['schemas']['ShowTrendingItemDto'];

const IMPORT_PATHS: Record<MediaType, string> = {
  movie: 'catalog/import/movie',
  show: 'catalog/import/show',
};

export const catalogApi = {
  search(query: string, signal?: AbortSignal): Promise<SearchResponse> {
    return apiGet<SearchResponse>('catalog/search', { searchParams: { query }, signal });
  },

  importMedia(type: MediaType, tmdbId: number): Promise<ImportResult> {
    return apiPost<ImportResult>(`${IMPORT_PATHS[type]}/${tmdbId}`);
  },

  getImportStatus(jobId: string, signal?: AbortSignal): Promise<ImportJobStatus> {
    return apiGet<ImportJobStatus>(`catalog/import/status/${jobId}`, { signal });
  },

  async getTrendingMovies(limit: number): Promise<TrendingMovie[]> {
    const page = await apiGet<GetData<'/api/catalog/movies/trending'>>('catalog/movies/trending', {
      searchParams: { limit, context: 'home' },
    });
    return page.data;
  },

  async getTrendingShows(limit: number): Promise<TrendingShow[]> {
    const page = await apiGet<GetData<'/api/catalog/shows/trending'>>('catalog/shows/trending', {
      searchParams: { limit, context: 'home' },
    });
    return page.data;
  },
} as const;
