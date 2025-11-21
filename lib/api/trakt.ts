import { TraktTrendingShow, TraktShow } from '@/lib/types';

const TRAKT_BASE_URL = 'https://api.trakt.tv';

/**
 * Клієнт Trakt API: тренди, перегляди за період, рейтинги, календар.
 *
 * @example
 * import { getTraktClient } from '@/lib/api/trakt';
 * const trakt = getTraktClient();
 * const trending = await trakt.getTrendingShows(50);
 * const watchedMonthly = await trakt.getWatchedShows('monthly', '2025-11-01', 100);
 * const ratings = await trakt.getShowRatings('game-of-thrones');
 */
export class TraktClient {
  private clientId: string;

  constructor(clientId?: string) {
    this.clientId = clientId || process.env.TRAKT_CLIENT_ID || '';
    if (!this.clientId) {
      throw new Error('Trakt Client ID is required');
    }
  }

  /**
   * Запит до Trakt з базовими заголовками; кешується Next на 1 год.
   */
  private async fetch<T>(endpoint: string): Promise<T> {
    const url = `${TRAKT_BASE_URL}${endpoint}`;
    const makeReq = async () =>
      fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'trakt-api-version': '2',
          'trakt-api-key': this.clientId,
          'User-Agent': process.env.APP_USER_AGENT || 'ratingo/1.0.0',
        },
        next: { revalidate: 3600 },
      });
    let response = await makeReq();
    if (response.status === 429) {
      const ra = response.headers.get('Retry-After');
      const ms = Math.max(0, Math.round((parseFloat(String(ra || '10')) || 10) * 1000));
      await new Promise((r) => setTimeout(r, ms));
      response = await makeReq();
    }
    if (!response.ok) {
      throw new Error(`Trakt API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Запит без кешу для великих відповідей (>2MB), наприклад календар.
   */
  private async fetchNoStore<T>(endpoint: string): Promise<T> {
    const url = `${TRAKT_BASE_URL}${endpoint}`;
    const makeReq = async () =>
      fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'trakt-api-version': '2',
          'trakt-api-key': this.clientId,
          'User-Agent': process.env.APP_USER_AGENT || 'ratingo/1.0.0',
        },
        cache: 'no-store',
      });
    let response = await makeReq();
    if (response.status === 429) {
      const ra = response.headers.get('Retry-After');
      const ms = Math.max(0, Math.round((parseFloat(String(ra || '10')) || 10) * 1000));
      await new Promise((r) => setTimeout(r, ms));
      response = await makeReq();
    }
    if (!response.ok) {
      throw new Error(`Trakt API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Трендові шоу Trakt.
   *
   * @example
   * const list = await trakt.getTrendingShows(100);
   */
  async getTrendingShows(limit: number = 20): Promise<TraktTrendingShow[]> {
    return this.fetch<TraktTrendingShow[]>(`/shows/trending?limit=${limit}`);
  }

  async getTrendingMovies(limit: number = 20): Promise<any[]> {
    /**
     * Трендові фільми Trakt.
     *
     * @example
     * const list = await trakt.getTrendingMovies(100);
     */
    return this.fetch<any[]>(`/movies/trending?limit=${limit}`);
  }

  /**
   * Найбільш переглянуті шоу за період (`daily|weekly|monthly|yearly`).
   * `startDate` (YYYY-MM-DD) задає початок календарного періоду.
   *
   * @example
   * const m = await trakt.getWatchedShows('monthly', '2025-11-01', 200);
   */
  async getWatchedShows(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
    startDate?: string,
    limit: number = 100
  ): Promise<any[]> {
    const start = startDate ? `/${startDate}` : '';
    return this.fetch<any[]>(`/shows/watched/${period}${start}?limit=${limit}`);
  }

  async getWatchedMovies(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
    startDate?: string,
    limit: number = 100
  ): Promise<any[]> {
    /**
     * Найбільш переглянуті фільми за період (`daily|weekly|monthly|yearly`).
     * `startDate` (YYYY-MM-DD) задає початок календарного періоду.
     */
    const start = startDate ? `/${startDate}` : '';
    return this.fetch<any[]>(`/movies/watched/${period}${start}?limit=${limit}`);
  }

  /**
   * Пошук даних шоу Trakt за TMDB ID.
   */
  async findShowByTmdbId(tmdbId: number): Promise<TraktTrendingShow | null> {
    try {
      const trendingShows = await this.getTrendingShows(100);
      const show = trendingShows.find((item) => item.show.ids.tmdb === tmdbId);
      return show || null;
    } catch (error) {
      console.error(`Error finding Trakt show for TMDB ID ${tmdbId}:`, error);
      return null;
    }
  }

  async findMovieByTmdbId(tmdbId: number): Promise<any | null> {
    /**
     * Пошук трендового фільму Trakt за TMDB ID.
     */
    try {
      const trendingMovies = await this.getTrendingMovies(100);
      const item = trendingMovies.find((it: any) => it.movie?.ids?.tmdb === tmdbId);
      return item || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Оцінка популярності шоу за TMDB ID (кількість `watchers`).
   */
  async getPopularityScore(tmdbId: number): Promise<number> {
    const show = await this.findShowByTmdbId(tmdbId);
    return show?.watchers || 0;
  }
  /**
   * Глобальний календар майбутніх епізодів.
   */
  async getCalendarShows(startDate: string, days: number = 7): Promise<any[]> {
    // Calendar payloads can exceed 2MB for larger windows; disable caching
    return this.fetchNoStore<any[]>(`/calendars/all/shows/${startDate}/${days}`);
  }
  /**
   * Рейтинги шоу (середній та кількість голосів, дистрибуція).
   *
   * @example
   * const r = await trakt.getShowRatings('game-of-thrones');
   */
  async getShowRatings(
    idOrSlug: string | number
  ): Promise<{ rating: number; votes: number; distribution?: Record<string, number> }> {
    const endpoint = `/shows/${idOrSlug}/ratings`;
    return this.fetch<{ rating: number; votes: number; distribution?: Record<string, number> }>(
      endpoint
    );
  }

  async getMovieRatings(
    idOrSlug: string | number
  ): Promise<{ rating: number; votes: number; distribution?: Record<string, number> }> {
    /**
     * Рейтинги фільму (середній, кількість голосів, дистрибуція 1..10).
     */
    const endpoint = `/movies/${idOrSlug}/ratings`;
    return this.fetch<{ rating: number; votes: number; distribution?: Record<string, number> }>(
      endpoint
    );
  }

  async getRelatedShows(idOrSlug: string | number, limit: number = 12): Promise<TraktShow[]> {
    return this.fetch<TraktShow[]>(`/shows/${idOrSlug}/related?limit=${limit}`);
  }
}

// Export singleton instance - lazy initialization
let traktClientInstance: TraktClient | null = null;

export function getTraktClient(): TraktClient {
  if (!traktClientInstance) {
    traktClientInstance = new TraktClient();
  }
  return traktClientInstance;
}

export const traktClient = new Proxy({} as TraktClient, {
  get(target, prop) {
    return getTraktClient()[prop as keyof TraktClient];
  },
});
