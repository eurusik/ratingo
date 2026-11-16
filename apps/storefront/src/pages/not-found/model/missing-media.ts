import type { MediaType } from '@/shared/api';
import { toCyrillic } from './transliterate';

export interface MissingMedia {
  type: MediaType;
  query: string;
}

type MediaSection = 'movies' | 'shows';

const MEDIA_PATH = /^\/(movies|shows)\/([^/]+)/;
const MEDIA_TYPES: Record<MediaSection, MediaType> = { movies: 'movie', shows: 'show' };
const NUMERIC_TOKEN = /^\d+$/;
const TMDB_FALLBACK_SLUG = /^tmdb-\d+$/;

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function slugToSearchQuery(slug: string): string {
  const words = safeDecode(slug).toLowerCase();
  if (TMDB_FALLBACK_SLUG.test(words)) return '';

  return words
    .split(/[-_\s]+/)
    .filter((token) => token !== '' && !NUMERIC_TOKEN.test(token))
    .map(toCyrillic)
    .join(' ');
}

export function missingMediaAt(pathname: string): MissingMedia | null {
  const match = MEDIA_PATH.exec(pathname);
  if (!match) return null;
  const [, section, slug] = match;
  return { type: MEDIA_TYPES[section as MediaSection], query: slugToSearchQuery(slug) };
}
