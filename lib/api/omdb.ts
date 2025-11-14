const OMDB_BASE_URL = 'http://www.omdbapi.com/';

/**
 * Клієнт OMDb API: деталі за IMDb ID та агреговані рейтинги.
 *
 * @example
 * import { getOMDbClient } from '@/lib/api/omdb';
 * const omdb = getOMDbClient();
 * const agg = await omdb.getAggregatedRatings('tt0944947'); // Game of Thrones
 */
export class OMDbClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OMDB_API_KEY || '';
  }

  /**
   * Запит до OMDb з `apikey` і параметрами; кеш на 24 години.
   */
  private async fetch<T>(params: Record<string, string>): Promise<T> {
    if (!this.apiKey) {
      throw new Error('OMDb API key is required');
    }

    const url = new URL(OMDB_BASE_URL);
    url.searchParams.set('apikey', this.apiKey);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString(), {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      throw new Error(`OMDb API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Деталі шоу за IMDb ID.
   *
   * @example
   * const d = await omdb.getByImdbId('tt0944947');
   */
  async getByImdbId(imdbId: string): Promise<any> {
    return this.fetch({ i: imdbId, type: 'series' });
  }

  /**
   * IMDb-рейтинг для шоу.
   */
  async getImdbRating(imdbId: string): Promise<number | null> {
    try {
      const data = await this.getByImdbId(imdbId);
      if (data.imdbRating && data.imdbRating !== 'N/A') {
        return parseFloat(data.imdbRating);
      }
      return null;
    } catch (error) {
      console.warn(`Failed to get IMDb rating for ${imdbId}:`, error);
      return null;
    }
  }
  /**
   * Агреговані рейтинги: IMDb, Rotten Tomatoes, Metacritic, голоси, metascore.
   *
   * @example
   * const r = await omdb.getAggregatedRatings('tt0944947');
   */
  async getAggregatedRatings(imdbId: string): Promise<{
    imdbRating: number | null;
    imdbVotes: number | null;
    rottenTomatoes: number | null; // percent 0-100
    metacritic: number | null; // 0-100
    metascore: number | null; // 0-100
  }> {
    try {
      const data = await this.getByImdbId(imdbId);
      const imdbRating = data.imdbRating && data.imdbRating !== 'N/A' ? parseFloat(data.imdbRating) : null;
      const imdbVotes = data.imdbVotes ? parseInt(String(data.imdbVotes).replace(/,/g, ''), 10) : null;

      let rottenTomatoes: number | null = null;
      let metacritic: number | null = null;

      if (Array.isArray(data.Ratings)) {
        for (const r of data.Ratings) {
          if (r.Source === 'Rotten Tomatoes' && typeof r.Value === 'string') {
            const m = r.Value.match(/(\d+)%/);
            if (m) rottenTomatoes = parseInt(m[1], 10);
          }
          if (r.Source === 'Metacritic' && typeof r.Value === 'string') {
            const m = r.Value.match(/(\d+)/);
            if (m) metacritic = parseInt(m[1], 10);
          }
        }
      }

      const metascore = data.Metascore && data.Metascore !== 'N/A' ? parseInt(data.Metascore, 10) : null;

      return { imdbRating, imdbVotes, rottenTomatoes, metacritic, metascore };
    } catch (error) {
      console.warn(`Failed to get aggregated ratings for ${imdbId}:`, error);
      return { imdbRating: null, imdbVotes: null, rottenTomatoes: null, metacritic: null, metascore: null };
    }
  }

}

// Export singleton instance - lazy initialization
let omdbClientInstance: OMDbClient | null = null;

export function getOMDbClient(): OMDbClient {
  if (!omdbClientInstance) {
    omdbClientInstance = new OMDbClient();
  }
  return omdbClientInstance;
}

export const omdbClient = new Proxy({} as OMDbClient, {
  get(target, prop) {
    return getOMDbClient()[prop as keyof OMDbClient];
  },
});
