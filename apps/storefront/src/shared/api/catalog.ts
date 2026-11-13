import type { GetData, GetQuery, components } from '@ratingo/api-contract';
import { apiGet, apiPost } from '@ratingo/web-core/api';

export type SearchItem = components['schemas']['SearchItemDto'];
export type SearchResponse = components['schemas']['SearchResponseDto'];
export type MediaType = SearchItem['type'];
export type ImportResult = components['schemas']['ImportResultDto'];
export type ImportJobStatus = GetData<'/api/catalog/import/status/{jobId}'>;
export type TrendingMovie = components['schemas']['MovieListItemDto'];
export type TrendingShow = components['schemas']['ShowTrendingItemDto'];
export type HomeItem = components['schemas']['HeroItemDto'];
export type NewEpisode = components['schemas']['NewEpisodeDto'];
export type MovieDetails = components['schemas']['MovieResponseDto'];
export type ShowDetails = components['schemas']['ShowResponseDto'];
export type MediaBadge = NonNullable<components['schemas']['CardMetaDto']['badgeKey']>;
type PageMeta = components['schemas']['OffsetPaginationMetaDto'];

export type CatalogListQuery = Pick<
  NonNullable<GetQuery<'/api/catalog/movies/trending'>>,
  'limit' | 'offset' | 'sort' | 'genres' | 'yearFrom' | 'yearTo' | 'minQuality'
>;

export type MovieListPath =
  | 'catalog/movies/trending'
  | 'catalog/movies/popular'
  | 'catalog/movies/now-playing'
  | 'catalog/movies/new-releases'
  | 'catalog/movies/new-on-digital';
export type ShowListPath = 'catalog/shows/trending' | 'catalog/shows/popular';

export interface CatalogPage<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export interface CatalogCache {
  revalidateSeconds: number;
}

const IMPORT_PATHS: Record<MediaType, string> = {
  movie: 'catalog/import/movie',
  show: 'catalog/import/show',
};

const CACHED_REQUEST_TIMEOUT_MS = 5000;

function cacheOptions(cache: CatalogCache | undefined) {
  if (!cache) return {};
  return {
    next: { revalidate: cache.revalidateSeconds },
    timeout: CACHED_REQUEST_TIMEOUT_MS,
    retry: { limit: 1 },
  };
}

function definedParams(query: CatalogListQuery): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(query).filter((entry): entry is [string, string | number] => entry[1] != null),
  );
}

async function getCatalogPage<T>(
  path: MovieListPath | ShowListPath,
  query: CatalogListQuery,
  cache?: CatalogCache,
): Promise<CatalogPage<T>> {
  const page = await apiGet<{ data: T[]; meta: PageMeta }>(path, {
    searchParams: definedParams(query),
    ...cacheOptions(cache),
  });
  const total = page.meta.total ?? page.data.length;
  return { items: page.data, total, hasMore: page.meta.hasMore ?? false };
}

async function getMovieList(path: string, limit: number, cache?: CatalogCache) {
  const page = await apiGet<GetData<'/api/catalog/movies/now-playing'>>(path, {
    searchParams: { limit },
    ...cacheOptions(cache),
  });
  return page.data;
}

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

  async getTrendingMovies(limit: number, cache?: CatalogCache): Promise<TrendingMovie[]> {
    const page = await apiGet<GetData<'/api/catalog/movies/trending'>>('catalog/movies/trending', {
      searchParams: { limit, context: 'home' },
      ...cacheOptions(cache),
    });
    return page.data;
  },

  async getTrendingShows(limit: number, cache?: CatalogCache): Promise<TrendingShow[]> {
    const page = await apiGet<GetData<'/api/catalog/shows/trending'>>('catalog/shows/trending', {
      searchParams: { limit, context: 'home' },
      ...cacheOptions(cache),
    });
    return page.data;
  },

  getNowPlayingMovies(limit: number, cache?: CatalogCache): Promise<TrendingMovie[]> {
    return getMovieList('catalog/movies/now-playing', limit, cache);
  },

  getNewOnDigitalMovies(limit: number, cache?: CatalogCache): Promise<TrendingMovie[]> {
    return getMovieList('catalog/movies/new-on-digital', limit, cache);
  },

  async getNewEpisodes(days: number, limit: number, cache?: CatalogCache): Promise<NewEpisode[]> {
    const page = await apiGet<GetData<'/api/catalog/shows/new-episodes'>>(
      'catalog/shows/new-episodes',
      { searchParams: { days, limit }, ...cacheOptions(cache) },
    );
    return page.data;
  },

  getMoviePage(
    path: MovieListPath,
    query: CatalogListQuery,
    cache?: CatalogCache,
  ): Promise<CatalogPage<TrendingMovie>> {
    return getCatalogPage<TrendingMovie>(path, query, cache);
  },

  getShowPage(
    path: ShowListPath,
    query: CatalogListQuery,
    cache?: CatalogCache,
  ): Promise<CatalogPage<TrendingShow>> {
    return getCatalogPage<TrendingShow>(path, query, cache);
  },

  getMovieBySlug(slug: string, cache?: CatalogCache): Promise<MovieDetails> {
    return apiGet<MovieDetails>(`catalog/movies/${encodeURIComponent(slug)}`, cacheOptions(cache));
  },

  getShowBySlug(slug: string, cache?: CatalogCache): Promise<ShowDetails> {
    return apiGet<ShowDetails>(`catalog/shows/${encodeURIComponent(slug)}`, cacheOptions(cache));
  },

  getHomeHero(cache?: CatalogCache): Promise<HomeItem[]> {
    return apiGet<HomeItem[]>('home/hero', cacheOptions(cache));
  },
} as const;
