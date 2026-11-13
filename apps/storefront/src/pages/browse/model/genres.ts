import type { MediaType } from '@/shared/api';

export const GENRE_SLUGS = {
  show: [
    'drama',
    'komediya',
    'kryminal',
    'detektyv',
    'naukovo-fantastychnyy',
    'ekshn-i-pryhody',
    'multfilm',
    'simeynyy',
    'dytyachyy',
    'realiti-shou',
    'polityka-ta-viyna',
  ],
  movie: [
    'boyovyk',
    'komediya',
    'drama',
    'tryler',
    'zhakhy',
    'fantastyka',
    'fentezi',
    'kryminal',
    'detektyv',
    'pryhody',
    'melodrama',
    'multfilm',
    'simeynyy',
    'istorychnyy',
    'viyskovyy',
    'muzyka',
    'vestern',
  ],
} as const satisfies Record<MediaType, readonly string[]>;

export type GenreSlug = (typeof GENRE_SLUGS)[MediaType][number];

export function isGenreOf(type: MediaType, slug: string): slug is GenreSlug {
  return (GENRE_SLUGS[type] as readonly string[]).includes(slug);
}
