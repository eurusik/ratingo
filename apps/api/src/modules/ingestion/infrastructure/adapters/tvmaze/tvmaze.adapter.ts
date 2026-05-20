import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import { TvMazeApiException } from '../../../../../common/exceptions/external-api.exception';
import {
  HttpError,
  ResilientHttpClient,
  type RetryConfig,
} from '../../../../../common/http/resilient-http.client';
import tvmazeConfig from '../../../../../config/tvmaze.config';
import { type NormalizedEpisode } from '../../../domain/models/normalized-media.model';

const TVMAZE_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxTotalTimeMs: 20_000,
  timeoutMs: 10_000,
};

/**
 * TVMaze API response for show lookup.
 */
interface TvMazeShow {
  id: number;
  name?: string;
}

/**
 * TVMaze API response for episode.
 */
interface TvMazeEpisodeResponse {
  id: number;
  season: number;
  number: number;
  name: string;
  summary: string | null;
  airstamp: string | null;
  runtime: number | null;
  image: { original: string; medium: string } | null;
  rating: { average: number | null } | null;
}

/**
 * TVMaze episode with season number.
 */
export interface TvMazeEpisode extends NormalizedEpisode {
  seasonNumber: number;
}

/**
 * TVMaze adapter for fetching episodes schedule by IMDb ID.
 */
@Injectable()
export class TvMazeAdapter {
  private readonly logger = new Logger(TvMazeAdapter.name);
  private readonly httpClient = new ResilientHttpClient(TVMAZE_RETRY_CONFIG);

  constructor(
    @Inject(tvmazeConfig.KEY)
    private readonly config: ConfigType<typeof tvmazeConfig>,
  ) {}

  /**
   * Fetches episode schedule from TVMaze using IMDb ID.
   * Returns flat list of all episodes with normalized data and season number.
   *
   * @param {string} imdbId - IMDb ID (e.g. 'tt0944947')
   * @returns {Promise<TvMazeEpisode[]>} Episodes list
   */
  async getEpisodesByImdbId(imdbId: string): Promise<TvMazeEpisode[]> {
    try {
      // Lookup Show ID via IMDb ID (Follows redirects)
      const show = await this.fetch<TvMazeShow>(`/lookup/shows?imdb=${imdbId}`);

      if (!show || !show.id) {
        return [];
      }

      // Fetch all episodes
      const episodes = await this.fetch<TvMazeEpisodeResponse[]>(`/shows/${show.id}/episodes`);

      if (!Array.isArray(episodes)) return [];

      return episodes.map((ep) => this.mapEpisode(ep));
    } catch (error) {
      // 404 is common for new shows or shows not in TVMaze
      if (
        error instanceof TvMazeApiException &&
        error.details?.statusCode === HttpStatus.NOT_FOUND
      ) {
        return [];
      }
      this.logger.warn(
        `Failed to sync episodes from TVMaze for ${imdbId}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Maps TVMaze episode response to normalized episode model.
   * Strips HTML tags from summary and normalizes fields.
   */
  private mapEpisode(ep: TvMazeEpisodeResponse): TvMazeEpisode {
    return {
      seasonNumber: ep.season,
      number: ep.number,
      title: ep.name,
      overview: ep.summary ? ep.summary.replace(/<[^>]*>/g, '').trim() : null,
      airDate: ep.airstamp ? new Date(ep.airstamp) : null,
      runtime: ep.runtime,
      stillPath: ep.image?.original || null,
      rating: ep.rating?.average ?? null,
    };
  }

  /**
   * Fetches episodes from TVMaze using show name search.
   * Uses single search endpoint for best match, then fetches episodes.
   * Intended as fallback when IMDb lookup is unavailable.
   *
   * @param {string} showName - Show name to search for
   * @returns {Promise<TvMazeEpisode[]>} Episodes list
   */
  async getEpisodesByShowName(showName: string): Promise<TvMazeEpisode[]> {
    try {
      const show = await this.fetch<TvMazeShow | null>(
        `/singlesearch/shows?q=${encodeURIComponent(showName)}`,
      );

      if (!show || !show.id) return [];

      const episodes = await this.fetch<TvMazeEpisodeResponse[]>(`/shows/${show.id}/episodes`);

      if (!Array.isArray(episodes)) return [];

      return episodes.map((ep) => this.mapEpisode(ep));
    } catch (error) {
      if (
        error instanceof TvMazeApiException &&
        error.details?.statusCode === HttpStatus.NOT_FOUND
      ) {
        return [];
      }
      this.logger.warn(
        `Failed to search TVMaze by name "${showName}": ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Fetches TVMaze JSON endpoint with retry/backoff via ResilientHttpClient.
   *
   * @param {string} endpoint - Relative endpoint starting with slash
   * @returns {Promise<T>} Parsed JSON response
   */
  private async fetch<T>(endpoint: string): Promise<T> {
    const result = await this.httpClient.get<T>(`${this.config.apiUrl}${endpoint}`);

    if (!result.success || result.data === null) {
      const status =
        result.error instanceof HttpError ? result.error.status : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new TvMazeApiException(result.error?.message ?? 'Request failed', status ?? 500);
    }

    return result.data;
  }
}
