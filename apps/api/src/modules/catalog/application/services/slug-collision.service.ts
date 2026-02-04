import { Injectable } from '@nestjs/common';

/**
 * Service for handling media slug collisions.
 * Provides utilities to generate unique slugs when collisions occur.
 */
@Injectable()
export class SlugCollisionService {
  /**
   * Generates a unique slug by appending tmdbId suffix.
   * Handles edge case where slug already has the suffix to avoid double-suffixing.
   *
   * @param baseSlug - Original slug that collided
   * @param tmdbId - TMDB ID to use as suffix
   * @returns Unique slug with tmdbId suffix
   *
   * @example
   * generateUniqueSlug('the-matrix', 603) // 'the-matrix-603'
   * generateUniqueSlug('the-matrix-603', 603) // 'the-matrix-603' (no double suffix)
   */
  generateUniqueSlug(baseSlug: string, tmdbId: number): string {
    const suffix = `-${tmdbId}`;
    return this.hasTmdbIdSuffix(baseSlug, tmdbId) ? baseSlug : `${baseSlug}${suffix}`;
  }

  /**
   * Checks if slug already has the tmdbId suffix.
   *
   * @param slug - Slug to check
   * @param tmdbId - TMDB ID to look for as suffix
   * @returns True if slug ends with -tmdbId
   */
  hasTmdbIdSuffix(slug: string, tmdbId: number): boolean {
    return slug.endsWith(`-${tmdbId}`);
  }

  /**
   * Creates a fallback slug when original slug is missing or empty.
   *
   * @param tmdbId - TMDB ID to use for fallback
   * @returns Fallback slug in format 'tmdb-{tmdbId}'
   */
  createFallbackSlug(tmdbId: number): string {
    return `tmdb-${tmdbId}`;
  }

  /**
   * Creates a retry slug for collision scenario.
   * Uses fallback slug if original is missing.
   *
   * @param originalSlug - Original slug (may be undefined)
   * @param tmdbId - TMDB ID for suffix/fallback
   * @returns Unique slug for retry attempt
   */
  createRetrySlug(originalSlug: string | undefined, tmdbId: number): string {
    const baseSlug = originalSlug || this.createFallbackSlug(tmdbId);
    return this.generateUniqueSlug(baseSlug, tmdbId);
  }
}
