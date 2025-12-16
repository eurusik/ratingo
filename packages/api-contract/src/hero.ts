/**
 * Hero Section Types and Helpers
 * 
 * This module provides type-safe utilities for working with the /api/home/hero endpoint.
 * Use these helpers in the frontend to maintain consistency and avoid duplication.
 */

import type { components, GetData, GetJson, GetPath } from './index.js';

/**
 * Hero API path - use this constant for type-safe endpoint references
 */
export const HERO_PATH = '/api/home/hero' satisfies GetPath;

/**
 * Full response type from /api/home/hero (includes success wrapper)
 */
export type HeroResponse = GetJson<typeof HERO_PATH>;

/**
 * Hero data array (unwrapped from success response)
 */
export type HeroData = GetData<typeof HERO_PATH>;

/**
 * Single hero item type
 */
export type HeroItem = components['schemas']['HeroItemDto'];

/**
 * Hero stats type
 */
export type HeroStats = components['schemas']['HeroStatsDto'];

/**
 * Hero external ratings type
 */
export type HeroExternalRatings = components['schemas']['HeroExternalRatingsDto'];

/**
 * Image URLs type (used for poster and backdrop)
 */
export type HeroImage = components['schemas']['ImageDto'];

/**
 * Media type for hero items
 */
export type HeroMediaType = HeroItem['type'];

/**
 * Show progress info (for TV shows in hero)
 */
export type HeroShowProgress = NonNullable<HeroItem['showProgress']>;

/**
 * Type guard to check if hero item is a show (has showProgress)
 */
export function isHeroShow(item: HeroItem): item is HeroItem & { showProgress: HeroShowProgress } {
  return item.type === 'show' && item.showProgress !== undefined;
}

/**
 * Type guard to check if hero item is a movie
 */
export function isHeroMovie(item: HeroItem): item is HeroItem & { type: 'movie' } {
  return item.type === 'movie';
}

/**
 * Helper to get the primary trailer URL for a hero item
 * Returns full YouTube URL or null if no trailer
 */
export function getHeroTrailerUrl(item: HeroItem): string | null {
  if (!item.primaryTrailerKey) return null;
  return `https://www.youtube.com/watch?v=${item.primaryTrailerKey}`;
}

/**
 * Helper to get YouTube embed URL for a hero item
 * Returns embed URL or null if no trailer
 */
export function getHeroTrailerEmbedUrl(item: HeroItem): string | null {
  if (!item.primaryTrailerKey) return null;
  return `https://www.youtube.com/embed/${item.primaryTrailerKey}`;
}

/**
 * Helper to get the detail page path for a hero item
 */
export function getHeroDetailPath(item: HeroItem): string {
  return `/${item.type}/${item.slug}`;
}

/**
 * Helper to format hero item release date
 * Returns year only for simple display
 */
export function getHeroReleaseYear(item: HeroItem): number {
  return new Date(item.releaseDate).getFullYear();
}

/**
 * Helper to get a readable label for hero item status
 */
export function getHeroStatusLabel(item: HeroItem): 'new' | 'classic' | 'standard' {
  if (item.isNew) return 'new';
  if (item.isClassic) return 'classic';
  return 'standard';
}

/**
 * Helper to format show progress label (e.g., "S5E5")
 */
export function formatHeroShowProgress(progress: HeroShowProgress | undefined): string | null {
  if (!progress) return null;
  return progress.label || `S${progress.season}E${progress.episode}`;
}
