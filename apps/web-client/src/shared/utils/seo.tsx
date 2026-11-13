/**
 * SEO utilities for metadata generation.
 */

import type { Metadata } from 'next';
import type { components } from '@ratingo/api-contract';
import { getDictionary } from '@/shared/i18n';
import { formatRating, formatYear } from '@ratingo/web-core/lib';

type CastMember = components['schemas']['CastMemberDto'];
type ExternalRatingItem = components['schemas']['ExternalRatingItemDto'];

/** Media item for SEO metadata generation. */
export interface SeoMediaItem {
  title: string;
  originalTitle?: string | null;
  releaseDate?: string | null;
  overview?: string | null;
  poster?: { large?: string } | null;
  backdrop?: { large?: string } | null;
  credits?: { cast?: ReadonlyArray<Pick<CastMember, 'name'>> } | null;
  externalRatings?: { imdb?: Pick<ExternalRatingItem, 'rating'> | null } | null;
}

const SITE_TITLE_SUFFIX = ' | Ratingo';
const SERP_TITLE_MAX_LENGTH = 60;
const SEO_TITLE_MAX_LENGTH = SERP_TITLE_MAX_LENGTH - SITE_TITLE_SUFFIX.length;
const SEO_DESCRIPTION_MAX_LENGTH = 160;
const SEO_CAST_LIMIT = 2;
const DESCRIPTION_SEPARATOR = ' · ';

type SeoMediaDictionary = ReturnType<typeof getDictionary>['seo']['media'];

function truncateAtWord(text: string, maxLength: number): string {
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;
  const cut = chars.slice(0, maxLength - 1).join('');
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = lastSpace > cut.length * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.replace(/[\s,.;:—·-]+$/u, '')}…`;
}

function buildSeoTitle(
  media: SeoMediaItem,
  type: CreateMetadataOptions['type'],
  year: string,
  dict: SeoMediaDictionary,
): string {
  const base = year ? `${media.title} (${year})` : media.title;
  const keywords = dict.titleKeywords[type];
  const candidates = [
    `${base}: ${keywords}`,
    `${media.title}: ${keywords}`,
    `${media.title}: ${dict.titleKeywordsShort}`,
  ];
  return candidates.find((candidate) => candidate.length <= SEO_TITLE_MAX_LENGTH) ?? base;
}

function buildSeoDescription(
  media: SeoMediaItem,
  type: CreateMetadataOptions['type'],
  year: string,
  dict: SeoMediaDictionary,
): string {
  const originalTitle =
    media.originalTitle && media.originalTitle !== media.title ? media.originalTitle : null;
  const imdbRating = media.externalRatings?.imdb?.rating;
  const cast = (media.credits?.cast ?? [])
    .slice(0, SEO_CAST_LIMIT)
    .map((member) => member.name.trim())
    .filter(Boolean);

  const facts = [
    [originalTitle, year].filter(Boolean).join(', '),
    imdbRating ? `IMDb ${formatRating(imdbRating)}` : '',
    cast.length > 0 ? `${dict.castLabel}: ${cast.join(', ')}` : '',
  ].filter(Boolean);

  const overview = media.overview?.replace(/\s+/g, ' ').trim();
  const titleFact = `${dict.kindCapitalized[type]} «${media.title}»`;
  const leadFacts = overview && facts.length > 0 ? facts : [titleFact, ...facts];
  const lead = `${leadFacts.join(DESCRIPTION_SEPARATOR)}.`;

  return truncateAtWord(`${lead} ${overview || dict.watchOn}`, SEO_DESCRIPTION_MAX_LENGTH);
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

  const dict = getDictionary('uk').seo.media;
  const year = formatYear(media.releaseDate);
  const title = buildSeoTitle(media, options.type, year, dict);
  const shareTitle = year ? `${media.title} (${year})` : media.title;
  const description = buildSeoDescription(media, options.type, year, dict);
  const posterUrl = media.poster?.large;
  const backdropUrl = media.backdrop?.large;
  const ogType = options.type === 'show' ? 'video.tv_show' : 'video.movie';

  // Prefer backdrop for OG image, fallback to poster
  const ogImage = backdropUrl || posterUrl;

  // Build canonical URL when slug is provided
  const canonical = options.slug
    ? createCanonical(`/${options.type === 'show' ? 'shows' : 'movies'}/${options.slug}`)
    : undefined;

  return {
    title,
    description,
    ...(canonical ?? {}),
    openGraph: {
      title: `${shareTitle}${SITE_TITLE_SUFFIX}`,
      description,
      type: ogType,
      images: ogImage
        ? [{ url: ogImage, width: backdropUrl ? 1280 : 500, height: backdropUrl ? 720 : 750 }]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
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
export const SEO_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://ratingo.top')
  .trim()
  .replace(/\/$/, '');

export const IS_SEARCH_INDEXING_ENABLED = process.env.APP_ENV === 'production';

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

export function buildWebSiteJsonLd(baseUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Ratingo',
    url: baseUrl,
    inLanguage: 'uk',
  };
}
