import type { components } from '@ratingo/api-contract';
import { IMDB_FORMAT } from './imdb-format';
import type { ImportFormat } from './import-format';
import { KINOBAZA_FORMAT } from './kinobaza-format';
import { TMDB_FORMAT } from './tmdb-format';

export type ImportSource = components['schemas']['ImportMediaDto']['source'];

export const IMPORT_SOURCES = ['kinobaza', 'imdb', 'tmdb'] as const satisfies ImportSource[];

export const UPCOMING_SOURCES = ['letterboxd'] as const;

export type ListedSource = ImportSource | (typeof UPCOMING_SOURCES)[number];

export const SOURCE_FORMATS: Record<ImportSource, ImportFormat> = {
  kinobaza: KINOBAZA_FORMAT,
  imdb: IMDB_FORMAT,
  tmdb: TMDB_FORMAT,
};

export function isImportSource(value: string): value is ImportSource {
  return (IMPORT_SOURCES as readonly string[]).includes(value);
}
