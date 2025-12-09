import { Injectable, Logger } from '@nestjs/common';
import { NormalizedEpisode } from '../../../domain/models/normalized-media.model';

export interface TvMazeEpisode extends NormalizedEpisode {
  seasonNumber: number;
}

@Injectable()
export class TvMazeAdapter {
  private readonly logger = new Logger(TvMazeAdapter.name);
  private readonly BASE_URL = 'https://api.tvmaze.com';

  /**
   * Fetches episode schedule from TVMaze using IMDb ID.
   * Returns flat list of all episodes with normalized data and season number.
   */
  async getEpisodesByImdbId(imdbId: string): Promise<TvMazeEpisode[]> {
    try {
      // Lookup Show ID via IMDb ID (Follows redirects)
      const show = await this.fetch<{ id: number }>(`/lookup/shows?imdb=${imdbId}`);
      
      if (!show || !show.id) {
        return [];
      }

      // Fetch all episodes
      const episodes = await this.fetch<any[]>(`/shows/${show.id}/episodes`);
      
      if (!Array.isArray(episodes)) return [];

      return episodes.map(ep => ({
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
      if (error.message !== '404') {
        this.logger.warn(`Failed to sync episodes from TVMaze for ${imdbId}: ${error.message}`);
      }
      return [];
    }
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${this.BASE_URL}${endpoint}`);
    if (!res.ok) {
      throw new Error(`${res.status}`);
    }
    return res.json();
  }
}
