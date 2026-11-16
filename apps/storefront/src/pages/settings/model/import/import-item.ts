import type { components } from '@ratingo/api-contract';

type ImportItemDto = components['schemas']['ImportItemDto'];

export type ImportFileKind = 'ratings' | 'watchlist';
export type ImportMediaKind = 'movie' | 'show';

export interface ImportItem {
  imdbId?: string;
  tmdbId?: number;
  rating?: number;
  state: ImportItemDto['state'];
  title?: string;
  year?: number;
  kind?: ImportMediaKind;
}

export interface ParsedFile {
  items: ImportItem[];
  skippedRows: number;
}

export const FILE_KIND_STATE: Record<ImportFileKind, ImportItem['state']> = {
  ratings: 'completed',
  watchlist: 'planned',
};

const MIN_RATING = 0.5;
const MAX_RATING = 10;

export function positiveInt(raw: string | undefined): number | undefined {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isNaN(value) || value <= 0 ? undefined : value;
}

export function ratingFrom(raw: string | undefined): number | undefined {
  const value = Number.parseFloat(raw ?? '');
  return value >= MIN_RATING && value <= MAX_RATING ? value : undefined;
}

export function imdbIdFrom(raw: string | undefined): string | undefined {
  const value = raw?.trim() ?? '';
  return value.startsWith('tt') ? value : undefined;
}

export function hasIdentifier(item: Pick<ImportItem, 'imdbId' | 'tmdbId'>): boolean {
  return item.imdbId !== undefined || item.tmdbId !== undefined;
}

export function toImportItemDto({ kind: _kind, ...item }: ImportItem): ImportItemDto {
  return item;
}
