import { Inject, Injectable, Logger } from '@nestjs/common';

import { SEARCH_CONFIG } from '../../domain/constants/catalog.constants';
import {
  type IMediaMetadataPort,
  MEDIA_METADATA_PORT,
} from '../../domain/ports/media-metadata.port';
import {
  type IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../domain/repositories/media.repository.interface';
import {
  type HybridSearchResult,
  type LocalSearchResultItem,
  SEARCH_SOURCE,
  type TmdbSearchResultItem,
} from '../../domain/types/search.types';

/**
 * Orchestrates search across local database and TMDB.
 * Returns combined results with duplicates removed (local takes precedence).
 */
@Injectable()
export class CatalogSearchService {
  private readonly logger = new Logger(CatalogSearchService.name);

  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
    @Inject(MEDIA_METADATA_PORT)
    private readonly metadataPort: IMediaMetadataPort,
  ) {}

  /**
   * Performs hybrid search across local DB and TMDB.
   */
  async search(query: string): Promise<HybridSearchResult> {
    if (!query || query.trim().length < SEARCH_CONFIG.MIN_QUERY_LENGTH) {
      return { query, local: [], tmdb: [] };
    }

    try {
      const [localResults, tmdbResults] = await Promise.all([
        this.mediaRepository.search(query, SEARCH_CONFIG.RESULTS_LIMIT),
        this.metadataPort.searchMulti(query, 1),
      ]);

      const localTmdbIds = new Set(localResults.map((r) => r.tmdbId));

      const local: LocalSearchResultItem[] = localResults.map((r) => ({
        source: SEARCH_SOURCE.LOCAL,
        type: r.type,
        id: r.id,
        slug: r.slug,
        tmdbId: r.tmdbId,
        title: r.title,
        originalTitle: r.originalTitle,
        year: r.releaseDate ? new Date(r.releaseDate).getFullYear() || null : null,
        posterPath: r.posterPath,
        rating: r.rating || 0,
      }));

      const tmdb: TmdbSearchResultItem[] = tmdbResults
        .filter((r) => !localTmdbIds.has(r.externalIds.tmdbId))
        .slice(0, SEARCH_CONFIG.RESULTS_LIMIT)
        .map((r) => ({
          source: SEARCH_SOURCE.TMDB,
          type: r.type,
          tmdbId: r.externalIds.tmdbId,
          title: r.title,
          originalTitle: r.originalTitle,
          year: r.releaseDate ? new Date(r.releaseDate).getFullYear() || null : null,
          posterPath: r.posterPath,
          rating: r.rating || 0,
        }));

      return { query, local, tmdb };
    } catch (error) {
      this.logger.error(`Search failed for "${query}": ${error.message}`, error.stack);
      return { query, local: [], tmdb: [] };
    }
  }
}
