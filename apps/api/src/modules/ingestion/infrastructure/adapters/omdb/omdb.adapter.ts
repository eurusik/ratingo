import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import omdbConfig from '../../../../../config/omdb.config';
import { MediaType } from '../../../../../common/enums/media-type.enum';
import { OmdbApiException } from '../../../../../common/exceptions/external-api.exception';

/**
 * Adapter for OMDb API.
 * Used primarily for fetching additional ratings (IMDb, Rotten Tomatoes, Metacritic).
 */
@Injectable()
export class OmdbAdapter {
  private readonly logger = new Logger(OmdbAdapter.name);

  // OMDb specific constants
  private readonly NA_VALUE = 'N/A';
  private readonly SOURCE_ROTTEN_TOMATOES = 'Rotten Tomatoes';
  private readonly SOURCE_METACRITIC = 'Metacritic';

  // Mapping our types to OMDb types
  private readonly TYPE_MAPPING = {
    [MediaType.MOVIE]: 'movie',
    [MediaType.SHOW]: 'series',
  };

  constructor(
    @Inject(omdbConfig.KEY)
    private readonly config: ConfigType<typeof omdbConfig>
  ) {}

  /**
   * Internal helper to make requests to OMDb.
   *
   * @param {Record<string, string>} params - Query parameters
   * @returns {Promise<T>} Typed response
   */
  private async fetch<T>(params: Record<string, string>): Promise<T> {
    if (!this.config.apiKey) {
      throw new OmdbApiException('API key is required');
    }

    const url = new URL(this.config.apiUrl);
    url.searchParams.set('apikey', this.config.apiKey);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new OmdbApiException(`${response.status} ${response.statusText}`, response.status);
    }

    return response.json();
  }

  /**
   * Fetches aggregated ratings (IMDb, Rotten Tomatoes, Metacritic) for a media item.
   *
   * @param {string} imdbId - The IMDb ID of the content (e.g. tt1234567)
   * @param {MediaType} type - Type of content (MOVIE or SHOW)
   * @returns {Promise<object>} Object containing available ratings
   */
  async getAggregatedRatings(
    imdbId: string,
    type: MediaType
  ): Promise<{
    imdbRating: number | null;
    imdbVotes: number | null;
    rottenTomatoes: number | null;
    metacritic: number | null;
    metascore: number | null;
  }> {
    try {
      const omdbType = this.TYPE_MAPPING[type];
      const data = await this.fetch<any>({ i: imdbId, type: omdbType });

      const imdbRating =
        data.imdbRating && data.imdbRating !== this.NA_VALUE ? parseFloat(data.imdbRating) : null;

      const imdbVotes =
        data.imdbVotes && data.imdbVotes !== this.NA_VALUE
          ? parseInt(String(data.imdbVotes).replace(/,/g, ''), 10)
          : null;

      let rottenTomatoes: number | null = null;
      let metacritic: number | null = null;

      if (Array.isArray(data.Ratings)) {
        const rt = data.Ratings.find((r: any) => r.Source === this.SOURCE_ROTTEN_TOMATOES);
        if (rt?.Value) {
          const m = rt.Value.match(/(\d+)%/);
          if (m) rottenTomatoes = parseInt(m[1], 10);
        }

        const mc = data.Ratings.find((r: any) => r.Source === this.SOURCE_METACRITIC);
        if (mc?.Value) {
          const m = mc.Value.match(/(\d+)/);
          if (m) metacritic = parseInt(m[1], 10);
        }
      }

      const metascore =
        data.Metascore && data.Metascore !== this.NA_VALUE ? parseInt(data.Metascore, 10) : null;

      return { imdbRating, imdbVotes, rottenTomatoes, metacritic, metascore };
    } catch (error) {
      this.logger.warn(`Failed to get aggregated ratings for ${imdbId}: ${error}`);
      return {
        imdbRating: null,
        imdbVotes: null,
        rottenTomatoes: null,
        metacritic: null,
        metascore: null,
      };
    }
  }
}
