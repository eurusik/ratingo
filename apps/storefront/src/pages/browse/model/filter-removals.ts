import type { BrowseFilters, ScoreThreshold } from './browse-state';
import type { GenreSlug } from './genres';
import { hasYearRange, type YearRange } from './year-presets';

export type FilterRemoval =
  | { id: string; kind: 'genre'; genre: GenreSlug; next: BrowseFilters }
  | { id: string; kind: 'year'; range: YearRange; next: BrowseFilters }
  | { id: string; kind: 'score'; score: ScoreThreshold; next: BrowseFilters };

export interface RemovalTotal {
  removal: FilterRemoval;
  total: number;
}

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
      range: { yearFrom: filters.yearFrom, yearTo: filters.yearTo },
      next: { ...filters, yearFrom: undefined, yearTo: undefined },
    });
  }

  if (filters.minScore !== undefined) {
    removals.push({
      id: 'score',
      kind: 'score',
      score: filters.minScore,
      next: { ...filters, minScore: undefined },
    });
  }

  return removals;
}

export function bestRemoval(totals: readonly RemovalTotal[]): RemovalTotal | undefined {
  return totals.reduce<RemovalTotal | undefined>(
    (best, candidate) =>
      candidate.total > 0 && candidate.total > (best?.total ?? 0) ? candidate : best,
    undefined,
  );
}
