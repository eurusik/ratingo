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
    const { query } = result;
    return {
      query,
      local: result.local.map((item) => SearchMapper.toLocalItemDto(item, query)),
      tmdb: result.tmdb.map(SearchMapper.toTmdbItemDto),
    };
  }

  private static toLocalItemDto(item: LocalSearchResultItem, query: string): SearchItemDto {
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
      matchedAlternativeTitle: SearchMapper.findMatchedAltTitle(item.alternativeTitles, query),
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
      matchedAlternativeTitle: null,
    };
  }

  /**
   * Finds the alternative title that best matches the search query.
   * Returns null if no alt title matched (i.e., title/originalTitle matched directly).
   *
   * Checks substring match (mirrors DB ILIKE) and reverse containment.
   * Trigram-only matches (DB `%` operator) cannot be replicated in JS,
   * so those cases return null — the result still appears, just without a label.
   */
  private static findMatchedAltTitle(
    alternativeTitles: string[] | null,
    query: string,
  ): string | null {
    if (!alternativeTitles?.length) return null;

    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return null;

    // Substring match (mirrors ILIKE '%query%' in DB)
    const substringMatch = alternativeTitles.find((alt) => alt.toLowerCase().includes(lowerQuery));
    if (substringMatch) return substringMatch;

    // Reverse: query contains alt title (e.g. query "Невразливий серіал" contains alt "Невразливий")
    const reverseMatch = alternativeTitles.find((alt) => lowerQuery.includes(alt.toLowerCase()));
    if (reverseMatch) return reverseMatch;

    return null;
  }
}
