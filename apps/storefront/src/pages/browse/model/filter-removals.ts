import type { BrowseFilters } from './browse-state';
import type { GenreSlug } from './genres';
import { hasYearRange } from './year-presets';

export type FilterRemoval =
  | { id: string; kind: 'genre'; genre: GenreSlug; next: BrowseFilters }
  | { id: string; kind: 'year'; next: BrowseFilters }
  | { id: string; kind: 'score'; next: BrowseFilters };

export function filterRemovals(filters: BrowseFilters): FilterRemoval[] {
  const removals: FilterRemoval[] = filters.genres.map((genre) => ({
    id: `genre:${genre}`,
    kind: 'genre',
    genre,
    next: { ...filters, genres: filters.genres.filter((slug) => slug !== genre) },
  }));

  if (hasYearRange(filters)) {
    removals.push({
      id: 'year',
      kind: 'year',
      next: { ...filters, yearFrom: undefined, yearTo: undefined },
    });
  }

  if (filters.minScore !== undefined) {
    removals.push({ id: 'score', kind: 'score', next: { ...filters, minScore: undefined } });
  }

  return removals;
}
