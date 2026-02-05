import { Injectable } from '@nestjs/common';

import { TmdbAdapter } from '@/modules/tmdb/public';

import type {
  IMediaMetadataPort,
  MediaMetadata,
  MetadataSearchResult,
} from '../../domain/ports/media-metadata.port';

/**
 * TMDB implementation of IMediaMetadataPort.
 * Delegates to TmdbAdapter and maps to catalog-owned domain types.
 */
@Injectable()
export class TmdbMetadataAdapter implements IMediaMetadataPort {
  constructor(private readonly tmdbAdapter: TmdbAdapter) {}

  async getMovie(tmdbId: number): Promise<MediaMetadata | null> {
    const media = await this.tmdbAdapter.getMovie(tmdbId);
    if (!media) return null;
    return { title: media.title };
  }

  async getShow(tmdbId: number): Promise<MediaMetadata | null> {
    const media = await this.tmdbAdapter.getShow(tmdbId);
    if (!media) return null;
    return { title: media.title };
  }

  async searchMulti(query: string, page?: number): Promise<MetadataSearchResult[]> {
    const results = await this.tmdbAdapter.searchMulti(query, page);
    return results.map((r) => ({
      externalIds: r.externalIds,
      type: r.type,
      title: r.title,
      originalTitle: r.originalTitle,
      releaseDate: r.releaseDate,
      posterPath: r.posterPath,
      rating: r.rating,
    }));
  }
}
