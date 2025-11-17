import { TMDBTrendingResponse, TMDBVideosResponse, TMDBShowDetails } from '@/lib/types';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

/**
 * Клієнт TMDB API: деталі шоу, переклади, відео, провайдери, рейтинги.
 *
 * @example
 * import { getTMDBClient } from '@/lib/api/tmdb';
 * const tmdb = getTMDBClient();
 * const details = await tmdb.getShowDetails(1399);
 * const ua = await tmdb.getShowTranslation(1399);
 * const providersUA = await tmdb.getWatchProvidersByRegion(1399, 'UA');
 */
export class TMDBClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TMDB_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('TMDB API key is required');
    }
  }

  /**
   * Внутрішній запит до TMDB із доданим `api_key` та базовими заголовками.
   */
  private async fetch<T>(endpoint: string): Promise<T> {
    const url = `${TMDB_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${this.apiKey}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Трендові серіали за вікном часу (`day|week`).
   */
  async getTrendingShows(
    page: number = 1,
    timeWindow: 'day' | 'week' = 'week'
  ): Promise<TMDBTrendingResponse> {
    return this.fetch<TMDBTrendingResponse>(
      `/trending/tv/${timeWindow}?page=${page}&language=uk-UA`
    );
  }

  async getTrendingMovies(
    page: number = 1,
    timeWindow: 'day' | 'week' = 'week'
  ): Promise<TMDBTrendingResponse> {
    /**
     * Трендові фільми за вікном часу (`day|week`).
     *
     * @example
     * const tmdb = getTMDBClient();
     * const list = await tmdb.getTrendingMovies(1, 'week');
     */
    return this.fetch<TMDBTrendingResponse>(
      `/trending/movie/${timeWindow}?page=${page}&language=uk-UA`
    );
  }

  /**
   * Популярні серіали (краще для місячних трендів).
   */
  async getPopularShows(page: number = 1): Promise<TMDBTrendingResponse> {
    return this.fetch<TMDBTrendingResponse>(`/tv/popular?page=${page}&language=uk-UA`);
  }

  async getPopularMovies(page: number = 1): Promise<TMDBTrendingResponse> {
    /**
     * Популярні фільми (краще для місячних трендів).
     */
    return this.fetch<TMDBTrendingResponse>(`/movie/popular?page=${page}&language=uk-UA`);
  }

  /**
   * Жанри шоу для фільтрації аніме.
   */
  async getShowGenres(showId: number): Promise<number[]> {
    try {
      const response = await this.fetch<any>(`/tv/${showId}`);
      return response.genres?.map((g: any) => g.id) || [];
    } catch (error) {
      console.warn(`Failed to get genres for show ${showId}:`, error);
      return [];
    }
  }

  /**
   * Український переклад назви/опису та постер.
   */
  async getShowTranslation(showId: number): Promise<any> {
    try {
      const response = await this.fetch<any>(`/tv/${showId}?language=uk-UA`);
      return {
        titleUk: response.name || null,
        overviewUk: response.overview || null,
        posterUk: response.poster_path || null, // Ukrainian poster if available
      };
    } catch (error) {
      console.warn(`Failed to get Ukrainian translation for show ${showId}:`, error);
      return { titleUk: null, overviewUk: null, posterUk: null };
    }
  }

  async getMovieTranslation(movieId: number): Promise<any> {
    /**
     * Український переклад назви/опису та постер для фільму.
     */
    try {
      const response = await this.fetch<any>(`/movie/${movieId}?language=uk-UA`);
      return {
        titleUk: response.title || null,
        overviewUk: response.overview || null,
        posterUk: response.poster_path || null,
      };
    } catch (error) {
      return { titleUk: null, overviewUk: null, posterUk: null };
    }
  }

  /**
   * Відео (трейлери, тизери) для шоу.
   */
  async getShowVideos(showId: number): Promise<TMDBVideosResponse> {
    return this.fetch<TMDBVideosResponse>(`/tv/${showId}/videos`);
  }

  async getMovieVideos(movieId: number): Promise<TMDBVideosResponse> {
    /**
     * Відео (трейлери, тизери) для фільму.
     */
    return this.fetch<TMDBVideosResponse>(`/movie/${movieId}/videos`);
  }

  /**
   * Детальна інформація про шоу.
   *
   * @example
   * const d = await tmdb.getShowDetails(1399);
   */
  async getShowDetails(showId: number): Promise<TMDBShowDetails> {
    return this.fetch<TMDBShowDetails>(`/tv/${showId}`);
  }

  async getMovieDetails(movieId: number): Promise<any> {
    /**
     * Детальна інформація про фільм.
     */
    return this.fetch<any>(`/movie/${movieId}`);
  }

  /**
   * Рекомендації для шоу (бек-ап для пов’язаних).
   */
  async getRecommendations(showId: number, page: number = 1): Promise<any> {
    return this.fetch<any>(`/tv/${showId}/recommendations?page=${page}&language=uk-UA`);
  }

  async getMovieRecommendations(movieId: number, page: number = 1): Promise<any> {
    /**
     * Рекомендації для фільму.
     */
    return this.fetch<any>(`/movie/${movieId}/recommendations?page=${page}&language=uk-UA`);
  }

  /**
   * Зовнішні ідентифікатори (включно з IMDb).
   */
  async getShowExternalIds(showId: number): Promise<any> {
    return this.fetch<any>(`/tv/${showId}/external_ids`);
  }

  async getMovieExternalIds(movieId: number): Promise<any> {
    /**
     * Зовнішні ідентифікатори фільму (включно з IMDb).
     */
    return this.fetch<any>(`/movie/${movieId}/external_ids`);
  }

  /**
   * Провайдери перегляду для регіону з категорією та link.
   * Повертає один запис на категорію для нормалізованого зберігання.
   *
   * @example
   * const ua = await tmdb.getWatchProvidersByRegion(1399, 'UA');
   */
  async getWatchProvidersByRegion(
    showId: number,
    region: string
  ): Promise<
    Array<{
      id: number;
      name: string;
      logo_path: string | null;
      region: string;
      category: string;
      rank: number | null;
      link: string | null;
    }>
  > {
    try {
      const data = await this.fetch<any>(`/tv/${showId}/watch/providers`);
      const results = data.results || {};
      const regionData = results[region];
      if (!regionData) return [];
      const regionLink: string | null = regionData.link || null;
      const make = (arr: any[] | undefined, category: string) =>
        (arr || []).map((p: any, idx: number) => ({
          id: p.provider_id,
          name: p.provider_name,
          logo_path: p.logo_path || null,
          region,
          category,
          rank:
            typeof p.display_priority === 'number'
              ? p.display_priority
              : Number.isFinite(idx)
                ? idx
                : null,
          link: regionLink,
        }));
      const out = [
        ...make(regionData.flatrate, 'flatrate'),
        ...make(regionData.free, 'free'),
        ...make(regionData.ads, 'ads'),
        ...make(regionData.rent, 'rent'),
        ...make(regionData.buy, 'buy'),
      ];
      return out;
    } catch (e) {
      console.warn(`Failed to get watch providers for ${showId} region ${region}:`, e);
      return [];
    }
  }

  async getMovieWatchProvidersByRegion(
    movieId: number,
    region: string
  ): Promise<
    Array<{
      id: number;
      name: string;
      logo_path: string | null;
      region: string;
      category: string;
      rank: number | null;
      link: string | null;
    }>
  > {
    /**
     * Провайдери перегляду фільму для регіону з категоріями та link.
     */
    try {
      const data = await this.fetch<any>(`/movie/${movieId}/watch/providers`);
      const results = data.results || {};
      const regionData = results[region];
      if (!regionData) return [];
      const regionLink: string | null = regionData.link || null;
      const make = (arr: any[] | undefined, category: string) =>
        (arr || []).map((p: any, idx: number) => ({
          id: p.provider_id,
          name: p.provider_name,
          logo_path: p.logo_path || null,
          region,
          category,
          rank:
            typeof p.display_priority === 'number'
              ? p.display_priority
              : Number.isFinite(idx)
                ? idx
                : null,
          link: regionLink,
        }));
      const out = [
        ...make(regionData.flatrate, 'flatrate'),
        ...make(regionData.free, 'free'),
        ...make(regionData.ads, 'ads'),
        ...make(regionData.rent, 'rent'),
        ...make(regionData.buy, 'buy'),
      ];
      return out;
    } catch (e) {
      return [];
    }
  }

  /**
   * Провайдери перегляду з регіональним fallback (UA → US → будь-який).
   */
  async getWatchProvidersUa(
    showId: number
  ): Promise<Array<{ id: number; name: string; logo_path: string | null; region: string }>> {
    try {
      const data = await this.fetch<any>(`/tv/${showId}/watch/providers`);
      const results = data.results || {};
      const regionKey = 'UA' in results ? 'UA' : 'US' in results ? 'US' : Object.keys(results)[0];
      if (!regionKey) return [];
      const region = results[regionKey];
      const sources = [
        ...(region.flatrate || []),
        ...(region.free || []),
        ...(region.ads || []),
        ...(region.rent || []),
        ...(region.buy || []),
      ];
      const byId: Record<
        number,
        { id: number; name: string; logo_path: string | null; region: string }
      > = {};
      for (const p of sources) {
        if (!byId[p.provider_id]) {
          byId[p.provider_id] = {
            id: p.provider_id,
            name: p.provider_name,
            logo_path: p.logo_path || null,
            region: regionKey,
          };
        }
      }
      return Object.values(byId);
    } catch (e) {
      console.warn(`Failed to get watch providers for ${showId}:`, e);
      return [];
    }
  }

  /**
   * Віковий рейтинг з регіональним fallback (UA → US → будь-який).
   */
  async getContentRatingUa(showId: number): Promise<string | null> {
    try {
      const data = await this.fetch<any>(`/tv/${showId}/content_ratings`);
      const results = data.results || [];
      const ua = results.find((r: any) => r.iso_3166_1 === 'UA');
      if (ua?.rating) return ua.rating;
      const us = results.find((r: any) => r.iso_3166_1 === 'US');
      if (us?.rating) return us.rating;
      return results[0]?.rating || null;
    } catch (e) {
      console.warn(`Failed to get content rating for ${showId}:`, e);
      return null;
    }
  }

  /**
   * Віковий рейтинг для конкретного регіону.
   */
  async getContentRatingByRegion(showId: number, region: string): Promise<string | null> {
    try {
      const data = await this.fetch<any>(`/tv/${showId}/content_ratings`);
      const results = data.results || [];
      const entry = results.find((r: any) => r.iso_3166_1 === region);
      return entry?.rating || null;
    } catch (e) {
      console.warn(`Failed to get content rating for ${showId} region ${region}:`, e);
      return null;
    }
  }

  async getMovieContentRatingByRegion(movieId: number, region: string): Promise<string | null> {
    /**
     * Сертифікат (контент-рейтинг) фільму для конкретного регіону.
     */
    try {
      const data = await this.fetch<any>(`/movie/${movieId}/release_dates`);
      const results = data.results || [];
      const entry = results.find((r: any) => r.iso_3166_1 === region);
      const cert = Array.isArray(entry?.release_dates)
        ? entry.release_dates.find((x: any) => x.certification)?.certification
        : null;
      return cert || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Повний URL постера за шляхом.
   */
  static getPosterUrl(
    path: string | null,
    size: 'w300' | 'w500' | 'original' = 'w500'
  ): string | null {
    if (!path) return null;
    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
  }

  /**
   * Повний URL бекдропу за шляхом.
   */
  static getBackdropUrl(
    path: string | null,
    size: 'w780' | 'w1280' | 'original' = 'w1280'
  ): string | null {
    if (!path) return null;
    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
  }

  /**
   * Агреговані кредити (каст та ролі).
   */
  async getAggregateCredits(showId: number): Promise<any> {
    const url = `${TMDB_BASE_URL}/tv/${showId}/aggregate_credits?api_key=${this.apiKey}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async getMovieCredits(movieId: number): Promise<any> {
    /**
     * Кредити фільму (каст).
     */
    const url = `${TMDB_BASE_URL}/movie/${movieId}/credits?api_key=${this.apiKey}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Зовнішні ідентифікатори для персони (включно з IMDb).
   */
  async getPersonExternalIds(personId: number): Promise<any> {
    try {
      return await this.fetch<any>(`/person/${personId}/external_ids`);
    } catch (e) {
      console.warn(`Failed to get external ids for person ${personId}:`, e);
      return {};
    }
  }
}

// Export singleton instance - lazy initialization
let tmdbClientInstance: TMDBClient | null = null;

export function getTMDBClient(): TMDBClient {
  if (!tmdbClientInstance) {
    tmdbClientInstance = new TMDBClient();
  }
  return tmdbClientInstance;
}

export const tmdbClient = new Proxy({} as TMDBClient, {
  get(target, prop) {
    return getTMDBClient()[prop as keyof TMDBClient];
  },
});
