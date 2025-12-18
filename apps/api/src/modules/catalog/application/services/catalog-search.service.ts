import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../domain/repositories/media.repository.interface';
import { TmdbAdapter } from '../../../tmdb/tmdb.adapter';
import { SearchResponseDto, SearchItemDto, SearchSource } from '../../presentation/dtos/search.dto';
import { ImageMapper } from '../../infrastructure/mappers/image.mapper';
import { MediaType } from '../../../../common/enums/media-type.enum';

/**
 * Orchestrates search across local database and TMDB.
 * Returns combined results with duplicates removed (local takes precedence).
 */
@Injectable()
export class CatalogSearchService {
  private readonly logger = new Logger(CatalogSearchService.name);
  private readonly SEARCH_RESULTS_LIMIT = 10;
  private readonly MIN_QUERY_LENGTH = 2;

  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
    private readonly tmdbAdapter: TmdbAdapter,
  ) {}

  /**
   * Performs hybrid search.
   *
   * @param {string} query - Search string
   * @returns {Promise<SearchResponseDto>} Combined search results split by source
   */
  async search(query: string): Promise<SearchResponseDto> {
    if (!query || query.trim().length < this.MIN_QUERY_LENGTH) {
      return { query, local: [], tmdb: [] };
    }

    try {
      // Parallel search
      const [localResults, tmdbResultsRaw] = await Promise.all([
        this.mediaRepository.search(query, this.SEARCH_RESULTS_LIMIT),
        this.tmdbAdapter.searchMulti(query, 1),
      ]);

      // Collect TMDB IDs from local results to filter duplicates
      const localTmdbIds = new Set(localResults.map((r) => r.tmdbId));

      // Map local results
      const local: SearchItemDto[] = localResults.map((r) => ({
        source: SearchSource.LOCAL,
        type: r.type as MediaType,
        id: r.id,
        mediaItemId: r.id,
        slug: r.slug,
        tmdbId: r.tmdbId,
        title: r.title,
        originalTitle: r.originalTitle,
        year: r.releaseDate ? new Date(r.releaseDate).getFullYear() || null : null,
        poster: ImageMapper.toPoster(r.posterPath),
        rating: r.rating || 0,
        isImported: true,
      }));

      // Filter and map TMDB results
      const tmdb: SearchItemDto[] = tmdbResultsRaw
        .filter((r) => !localTmdbIds.has(r.externalIds.tmdbId))
        .map((r) => ({
          source: SearchSource.TMDB,
          type: r.type,
          tmdbId: r.externalIds.tmdbId,
          title: r.title,
          originalTitle: r.originalTitle,
          year: r.releaseDate ? new Date(r.releaseDate).getFullYear() || null : null,
          poster: ImageMapper.toPoster(r.posterPath),
          rating: r.rating || 0,
          isImported: false,
        }))
        // Limit TMDB results to avoid overwhelming the client
        .slice(0, 10);

      return {
        query,
        local,
        tmdb,
      };
    } catch (error) {
      this.logger.error(`Search failed for "${query}": ${error.message}`, error.stack);
      // Fallback: return empty results instead of crashing
      return { query, local: [], tmdb: [] };
    }
  }
}
