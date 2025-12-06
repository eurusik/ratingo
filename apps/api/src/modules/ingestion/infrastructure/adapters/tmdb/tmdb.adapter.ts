import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { IMetadataProvider } from '../../../domain/interfaces/metadata-provider.interface';
import { NormalizedMedia } from '../../../domain/models/normalized-media.model';
import { TmdbMapper } from './mappers/tmdb.mapper';
import tmdbConfig from '@/config/tmdb.config';
import { MediaType } from '@/common/enums/media-type.enum';

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
      const data = await this.fetch(`/movie/${id}`, { append_to_response: 'credits,videos,release_dates' });
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
      const data = await this.fetch(`/tv/${id}`, { append_to_response: 'aggregate_credits,videos,content_ratings' });
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

  private async fetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(`${this.config.apiUrl}${endpoint}`);
    
    if (this.config.apiKey) {
      url.searchParams.append('api_key', this.config.apiKey);
    }
    
    url.searchParams.append('language', this.DEFAULT_LANG);
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`TMDB API Error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  private isNotFound(error: any): boolean {
    return error.message?.includes('404');
  }
}
