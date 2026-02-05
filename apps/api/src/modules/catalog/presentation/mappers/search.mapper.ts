import { ImageMapper } from '@/common/mappers/image.mapper';

import {
  HybridSearchResult,
  LocalSearchResultItem,
  TmdbSearchResultItem,
} from '../../domain/types/search.types';
import { SearchItemDto, SearchResponseDto } from '../dtos/search.dto';

/**
 * Maps domain search results to presentation DTOs.
 */
export class SearchMapper {
  static toResponseDto(result: HybridSearchResult): SearchResponseDto {
    return {
      query: result.query,
      local: result.local.map(SearchMapper.toLocalItemDto),
      tmdb: result.tmdb.map(SearchMapper.toTmdbItemDto),
    };
  }

  private static toLocalItemDto(item: LocalSearchResultItem): SearchItemDto {
    return {
      source: item.source,
      type: item.type,
      id: item.id,
      mediaItemId: item.id,
      slug: item.slug,
      tmdbId: item.tmdbId,
      title: item.title,
      originalTitle: item.originalTitle,
      year: item.year,
      poster: ImageMapper.toPoster(item.posterPath),
      rating: item.rating,
      isImported: true,
    };
  }

  private static toTmdbItemDto(item: TmdbSearchResultItem): SearchItemDto {
    return {
      source: item.source,
      type: item.type,
      tmdbId: item.tmdbId,
      title: item.title,
      originalTitle: item.originalTitle,
      year: item.year,
      poster: ImageMapper.toPoster(item.posterPath),
      rating: item.rating,
      isImported: item.isImported,
    };
  }
}
