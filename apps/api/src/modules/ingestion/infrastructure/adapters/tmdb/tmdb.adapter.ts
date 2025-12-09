import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { IMetadataProvider } from '../../../domain/interfaces/metadata-provider.interface';
import { NormalizedMedia } from '../../../domain/models/normalized-media.model';
import { TmdbMapper } from './mappers/tmdb.mapper';
import tmdbConfig from '../../../../../config/tmdb.config';
import { MediaType } from '../../../../../common/enums/media-type.enum';
import { TmdbApiException } from '../../../../../common/exceptions/external-api.exception';

/**
 * Implementation of MetadataProvider for The Movie Database (TMDB) API v3.
 * Handles fetching, error handling (404s), and mapping to domain models.
 */
@Injectable()
export class TmdbAdapter implements IMetadataProvider {
  public readonly providerName = 'tmdb';
  private readonly logger = new Logger(TmdbAdapter.name);
  private readonly DEFAULT_LANG = 'uk-UA';

  constructor(
    @Inject(tmdbConfig.KEY)
    private readonly config: ConfigType<typeof tmdbConfig>,
  ) {}

  /**
   * Fetches full movie details including credits and videos in a single request.
   * Returns null if the resource is not found (404).
   */
  public async getMovie(id: number): Promise<NormalizedMedia | null> {
    try {
      const data = await this.fetch(`/movie/${id}`, { append_to_response: 'credits,videos,release_dates,external_ids,translations,watch/providers' });
      return TmdbMapper.toDomain(data, MediaType.MOVIE);
    } catch (error) {
      if (this.isNotFound(error)) return null;
      this.logger.error(`Failed to fetch movie ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Fetches show details including aggregate credits and content ratings.
   */
  public async getShow(id: number): Promise<NormalizedMedia | null> {
    try {
      const data = await this.fetch(`/tv/${id}`, { append_to_response: 'aggregate_credits,videos,content_ratings,external_ids,translations,watch/providers' });
      return TmdbMapper.toDomain(data, MediaType.SHOW);
    } catch (error) {
      if (this.isNotFound(error)) return null;
      this.logger.error(`Failed to fetch show ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Retrieves trending movies and shows for the current day.
   * Filters out persons and other media types.
   */
  public async getTrending(page = 1): Promise<Array<{ tmdbId: number; type: MediaType }>> {
    const data = await this.fetch('/trending/all/day', { page: page.toString() });
    return (data.results || [])
      .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
      .map((item: any) => ({
        tmdbId: item.id,
        type: item.media_type === 'tv' ? MediaType.SHOW : MediaType.MOVIE,
      }));
  }

  /**
   * Retrieves IDs of movies currently playing in theaters.
   * Uses TMDB's now_playing endpoint which handles the "in theaters" logic.
   * 
   * @param region - ISO 3166-1 country code (default: UA)
   * @returns Array of TMDB movie IDs
   */
  public async getNowPlayingIds(region = 'UA'): Promise<number[]> {
    const ids: number[] = [];
    
    // Fetch first 2 pages (40 movies should be enough)
    for (let page = 1; page <= 2; page++) {
      const data = await this.fetch('/movie/now_playing', { 
        region, 
        page: page.toString() 
      });
      
      const pageIds = (data.results || []).map((m: any) => m.id);
      ids.push(...pageIds);
      
      // Stop if we've reached the last page
      if (page >= data.total_pages) break;
    }
    
    return ids;
  }

  /**
   * Retrieves IDs of movies released in theaters within the specified period.
   * Uses TMDB's discover endpoint with release date filters.
   * 
   * @param daysBack - Number of days to look back (default: 30)
   * @param region - ISO 3166-1 country code (default: UA)
   * @returns Array of TMDB movie IDs
   */
  public async getNewReleaseIds(daysBack = 30, region = 'UA'): Promise<number[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    
    const ids: number[] = [];
    
    // Fetch first 2 pages
    for (let page = 1; page <= 2; page++) {
      const data = await this.fetch('/discover/movie', {
        region,
        'primary_release_date.gte': cutoff.toISOString().split('T')[0],
        'primary_release_date.lte': now.toISOString().split('T')[0],
        'with_release_type': '3', // Theatrical
        'sort_by': 'popularity.desc',
        page: page.toString(),
      });
      
      const pageIds = (data.results || []).map((m: any) => m.id);
      ids.push(...pageIds);
      
      if (page >= data.total_pages) break;
    }
    
    return ids;
  }

  private async fetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(`${this.config.apiUrl}${endpoint}`);
    
    if (this.config.apiKey) {
      url.searchParams.append('api_key', this.config.apiKey);
    }
    
    url.searchParams.append('language', this.DEFAULT_LANG);
    url.searchParams.append('include_video_language', 'uk,en');
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      if (res.status === 404) {
        throw new TmdbApiException('Resource not found', 404);
      }
      throw new TmdbApiException(`${res.status} ${res.statusText}`, res.status);
    }
    return res.json();
  }

  private isNotFound(error: any): boolean {
    return error instanceof TmdbApiException && error.details?.statusCode === 404;
  }
}
