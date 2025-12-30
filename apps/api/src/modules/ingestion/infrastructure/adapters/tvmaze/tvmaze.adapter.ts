import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { NormalizedEpisode } from '../../../domain/models/normalized-media.model';
import { TvMazeApiException } from '../../../../../common/exceptions/external-api.exception';
import tvmazeConfig from '../../../../../config/tvmaze.config';

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

      return episodes.map((ep) => ({
        seasonNumber: ep.season,
        number: ep.number,
        title: ep.name,
        overview: ep.summary ? ep.summary.replace(/<[^>]*>/g, '') : null, // Strip HTML tags
        airDate: ep.airstamp ? new Date(ep.airstamp) : null,
        runtime: ep.runtime,
        stillPath: ep.image?.original || null,
        rating: null,
      }));
    } catch (error) {
      // 404 is common for new shows or shows not in TVMaze
      if (error instanceof TvMazeApiException && error.details?.statusCode === 404) {
        return [];
      }
      this.logger.warn(
        `Failed to sync episodes from TVMaze for ${imdbId}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Fetches TVMaze JSON endpoint.
   *
   * @param {string} endpoint - Relative endpoint starting with slash
   * @returns {Promise<T>} Parsed JSON response
   */
  private async fetch<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${this.config.apiUrl}${endpoint}`);
    if (!res.ok) {
      throw new TvMazeApiException(`HTTP ${res.status}`, res.status);
    }
    return res.json();
  }
}
