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
      tmdb: result.tmdb.map((item) => SearchMapper.toTmdbItemDto(item, query)),
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

  private static toTmdbItemDto(item: TmdbSearchResultItem, query: string): SearchItemDto {
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
      matchedAlternativeTitle:
        SearchMapper.findMatchedAltTitle(item.alternativeTitles, query) ??
        (SearchMapper.queryMatchesTitle(query, item.title, item.originalTitle)
          ? SearchMapper.findComplementaryTitle(item.alternativeTitles, item.title)
          : null),
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

  /**
   * Checks whether the search query matches the primary title or originalTitle
   * via case-insensitive substring match (either direction).
   * Used to gate complementary title lookup for TMDB results — we only show
   * a complementary alt title when the item was matched by its own title,
   * not when TMDB returned it via its own relevance engine.
   */
  private static queryMatchesTitle(
    query: string,
    title: string,
    originalTitle: string | null,
  ): boolean {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return false;

    const lowerTitle = title.toLowerCase().trim();
    if (lowerTitle.includes(lowerQuery) || lowerQuery.includes(lowerTitle)) return true;

    if (originalTitle) {
      const lowerOriginal = originalTitle.toLowerCase().trim();
      if (lowerOriginal.includes(lowerQuery) || lowerQuery.includes(lowerOriginal)) return true;
    }

    return false;
  }

  /** Matches Latin-script characters (Basic Latin + Extended). */
  private static readonly LATIN_RE = /[a-z\u00C0-\u024F]/i;

  /**
   * When the primary title matched the query directly, picks the best
   * alternative title that differs from the primary title.
   * Prefers Latin-script titles (English, Spanish, etc.) over Cyrillic/CJK
   * so that Ukrainian users see the international name.
   */
  private static findComplementaryTitle(
    alternativeTitles: string[] | null,
    title: string,
  ): string | null {
    if (!alternativeTitles?.length) return null;

    const lowerTitle = title.toLowerCase().trim();
    const candidates = alternativeTitles.filter((alt) => alt.toLowerCase().trim() !== lowerTitle);
    if (!candidates.length) return null;

    // Prefer Latin-script title (most useful for Ukrainian audience)
    return candidates.find((alt) => SearchMapper.LATIN_RE.test(alt)) ?? candidates[0];
  }
}
