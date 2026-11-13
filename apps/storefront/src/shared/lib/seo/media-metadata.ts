import type { Metadata } from 'next';
import type { components } from '@ratingo/api-contract';
import { formatRating, formatYear } from '@ratingo/web-core/lib';
import { mediaRoute } from '@/shared/config';
import { DEFAULT_LOCALE, getDictionary } from '@/shared/i18n';

type CastMember = components['schemas']['CastMemberDto'];
type ExternalRatingItem = components['schemas']['ExternalRatingItemDto'];
type SeoMediaKind = 'show' | 'movie';
type SeoMediaDictionary = ReturnType<typeof getDictionary>['seo']['media'];

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

export interface MediaMetadataOptions {
  type: SeoMediaKind;
  fallbackTitle?: string;
  fallbackDescription?: string;
  slug?: string;
}

const SITE_TITLE_SUFFIX = ' | Ratingo';
const SERP_TITLE_MAX_LENGTH = 60;
const SEO_TITLE_MAX_LENGTH = SERP_TITLE_MAX_LENGTH - SITE_TITLE_SUFFIX.length;
const SEO_DESCRIPTION_MAX_LENGTH = 160;
const SEO_CAST_LIMIT = 2;
const DESCRIPTION_SEPARATOR = ' · ';
const WORD_BREAK_MIN_RATIO = 0.6;
const TRAILING_PUNCTUATION = /[\s,.;:—·-]+$/u;
const NOT_FOUND_TITLE = 'Не знайдено';
const NOT_FOUND_DESCRIPTION = 'Контент не знайдено на Ratingo';

const OPEN_GRAPH_TYPES: Record<SeoMediaKind, 'video.tv_show' | 'video.movie'> = {
  show: 'video.tv_show',
  movie: 'video.movie',
};

const BACKDROP_IMAGE_SIZE = { width: 1280, height: 720 };
const POSTER_IMAGE_SIZE = { width: 500, height: 750 };

function truncateAtWord(text: string, maxLength: number): string {
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;
  const cut = chars.slice(0, maxLength - 1).join('');
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = lastSpace > cut.length * WORD_BREAK_MIN_RATIO ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.replace(TRAILING_PUNCTUATION, '')}…`;
}

function titleWithYear(media: SeoMediaItem, year: string): string {
  return year ? `${media.title} (${year})` : media.title;
}

function buildSeoTitle(
  media: SeoMediaItem,
  type: SeoMediaKind,
  year: string,
  dict: SeoMediaDictionary,
): string {
  const base = titleWithYear(media, year);
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
  type: SeoMediaKind,
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

function shareImage(media: SeoMediaItem) {
  const backdropUrl = media.backdrop?.large;
  if (backdropUrl) return { url: backdropUrl, ...BACKDROP_IMAGE_SIZE };
  const posterUrl = media.poster?.large;
  return posterUrl ? { url: posterUrl, ...POSTER_IMAGE_SIZE } : null;
}

export function createMediaMetadata(
  media: SeoMediaItem | null,
  options: MediaMetadataOptions,
): Metadata {
  if (!media) {
    return {
      title: options.fallbackTitle || NOT_FOUND_TITLE,
      description: options.fallbackDescription || NOT_FOUND_DESCRIPTION,
    };
  }

  const dict = getDictionary(DEFAULT_LOCALE).seo.media;
  const year = formatYear(media.releaseDate);
  const shareTitle = titleWithYear(media, year);
  const description = buildSeoDescription(media, options.type, year, dict);
  const image = shareImage(media);

  return {
    title: buildSeoTitle(media, options.type, year, dict),
    description,
    ...(options.slug ? { alternates: { canonical: mediaRoute(options.type, options.slug) } } : {}),
    openGraph: {
      title: `${shareTitle}${SITE_TITLE_SUFFIX}`,
      description,
      type: OPEN_GRAPH_TYPES[options.type],
      images: image ? [image] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description,
      images: image ? [image.url] : [],
    },
  };
}

export function createNotFoundMetadata(type: SeoMediaKind): Metadata {
  const title = getDictionary(DEFAULT_LOCALE).seo.notFound[type];
  return { title, description: title };
}
