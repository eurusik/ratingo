/**
 * SEO utilities for generating metadata.
 *
 * Provides helper functions to create consistent metadata across pages.
 */

import type { Metadata } from 'next';

/** Media item for SEO metadata generation. */
export interface SeoMediaItem {
  title: string;
  overview?: string | null;
  poster?: { large?: string } | null;
  backdrop?: { large?: string } | null;
}

/** Options for metadata generation. */
export interface CreateMetadataOptions {
  /** Media type for Open Graph. */
  type: 'show' | 'movie';
  /** Fallback title if media not found. */
  fallbackTitle?: string;
  /** Fallback description if media not found. */
  fallbackDescription?: string;
}

/**
 * Creates metadata for a media item (show or movie).
 *
 * @param media - Media item with title, overview, and images
 * @param options - Metadata options
 * @returns Next.js Metadata object
 *
 * @example
 * export async function generateMetadata({ params }) {
 *   const show = await catalogApi.getShowBySlug(params.slug);
 *   return createMediaMetadata(show, { type: 'show' });
 * }
 */
export function createMediaMetadata(
  media: SeoMediaItem | null,
  options: CreateMetadataOptions
): Metadata {
  if (!media) {
    return {
      title: options.fallbackTitle || 'Не знайдено',
      description: options.fallbackDescription || 'Контент не знайдено на Ratingo',
    };
  }

  const title = media.title;
  const description = media.overview?.slice(0, 160) || `Дивіться ${title} на Ratingo`;
  const posterUrl = media.poster?.large;
  const backdropUrl = media.backdrop?.large;
  const ogType = options.type === 'show' ? 'video.tv_show' : 'video.movie';

  // Prefer backdrop for OG image, fallback to poster
  const ogImage = backdropUrl || posterUrl;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Ratingo`,
      description,
      type: ogType,
      images: ogImage
        ? [{ url: ogImage, width: backdropUrl ? 1280 : 500, height: backdropUrl ? 720 : 750 }]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

/**
 * Creates error metadata for when media is not found.
 *
 * @param type - Media type
 * @returns Next.js Metadata object
 */
export function createNotFoundMetadata(type: 'show' | 'movie'): Metadata {
  const label = type === 'show' ? 'Серіал' : 'Фільм';
  return {
    title: `${label} не знайдено`,
    description: `${label} не знайдено на Ratingo`,
  };
}
