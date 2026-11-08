export const IMPORT_SOURCE = {
  KINOBAZA: 'kinobaza',
  IMDB: 'imdb',
  TMDB: 'tmdb',
} as const;
export type ImportSource = (typeof IMPORT_SOURCE)[keyof typeof IMPORT_SOURCE];

export const IMPORT_LIMITS = {
  MAX_ITEMS: 10_000,
} as const;

export const MEDIA_LOOKUP_PORT = Symbol('MEDIA_LOOKUP_PORT');
