/**
 * SEO utilities for metadata generation.
 */

import type { Metadata } from 'next';
import { getDictionary } from '@/shared/i18n';

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
  /** URL slug for canonical link generation (e.g. "breaking-bad-2008"). */
  slug?: string;
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
  options: CreateMetadataOptions,
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

  // Build canonical URL when slug is provided
  const canonical = options.slug ? createCanonical(`/${options.type === 'show' ? 'shows' : 'movies'}/${options.slug}`) : undefined;

  return {
    title,
    description,
    ...(canonical ?? {}),
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
  const dict = getDictionary('uk');
  const title = dict.seo.notFound[type];
  return {
    title,
    description: title,
  };
}

/**
 * Canonical base URL for the site.
 * Centralised here so all SEO helpers use the same env var.
 */
export const SEO_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ratingo.top';

/**
 * Returns an `alternates.canonical` object for use in Next.js Metadata.
 *
 * @param path - Absolute path starting with `/` (e.g. `/shows/breaking-bad-2008`)
 * @returns Object with `alternates.canonical` set to the full URL
 *
 * @example
 * export const metadata: Metadata = {
 *   ...createCanonical('/shows/breaking-bad-2008'),
 * };
 */
export function createCanonical(path: string): { alternates: { canonical: string } } {
  return { alternates: { canonical: `${SEO_BASE_URL}${path}` } };
}

/**
 * Inline JSON-LD script component for structured data.
 * Safe to use in Server Components — dangerouslySetInnerHTML is serialized on the server.
 *
 * `<` is escaped to `\u003c` to prevent premature `</script>` tag closure
 * if user-generated content contains that sequence.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

/**
 * Builds an Organization schema.org JSON-LD object for the root layout.
 *
 * @param baseUrl - The canonical base URL of the site
 * @returns Schema.org Organization object
 */
export function buildOrganizationJsonLd(baseUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Ratingo',
    url: baseUrl,
    logo: `${baseUrl}/icon.png`,
    description: 'Український сервіс для відкриття стрімінгового контенту — серіали та фільми',
    sameAs: ['https://github.com/ratingo'],
  };
}
