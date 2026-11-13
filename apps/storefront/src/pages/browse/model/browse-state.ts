import type { CatalogListQuery } from '@/shared/api';
import { BROWSE_ROUTE } from '@/shared/config';
import type { BrowseCategory, BrowseCategorySlug } from './browse-category';
import { isGenreOf, type GenreSlug } from './genres';
import { hasYearRange, type YearRange } from './year-presets';

export const SCORE_THRESHOLDS = [6, 7, 8] as const;
export type ScoreThreshold = (typeof SCORE_THRESHOLDS)[number];

export type BrowseSort = 'recommended' | 'releaseDate' | 'lastAirDate';

export interface BrowseFilters extends YearRange {
  genres: GenreSlug[];
  minScore?: ScoreThreshold;
}

export interface BrowseState {
  sort: BrowseSort;
  filters: BrowseFilters;
}

export type BrowseSearchParams = Record<string, string | string[] | undefined>;

export const NO_FILTERS: BrowseFilters = { genres: [] };

export const BROWSE_PAGE_SIZE = 24;

const QUALITY_PER_SCORE_POINT = 10;
const EARLIEST_YEAR = 1870;
const LATEST_YEAR_AHEAD = 10;
const LIST_SEPARATOR = ',';

const PARAMS = {
  sort: 'sort',
  genres: 'genres',
  yearFrom: 'yearFrom',
  yearTo: 'yearTo',
  minQuality: 'minQuality',
} as const;

export function sortsFor(category: BrowseCategory): BrowseSort[] {
  return category.type === 'show'
    ? ['recommended', 'releaseDate', 'lastAirDate']
    : ['recommended', 'releaseDate'];
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseYear(value: string | undefined, currentYear: number): number | undefined {
  const year = Number(value);
  return Number.isInteger(year) && year >= EARLIEST_YEAR && year <= currentYear + LATEST_YEAR_AHEAD
    ? year
    : undefined;
}

function parseYearRange(params: BrowseSearchParams, currentYear: number): YearRange {
  const yearFrom = parseYear(firstValue(params[PARAMS.yearFrom]), currentYear);
  const yearTo = parseYear(firstValue(params[PARAMS.yearTo]), currentYear);
  if (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) return {};
  return { yearFrom, yearTo };
}

function parseGenres(category: BrowseCategory, params: BrowseSearchParams): GenreSlug[] {
  const requested = firstValue(params[PARAMS.genres])?.split(LIST_SEPARATOR) ?? [];
  const known = requested.filter((slug): slug is GenreSlug => isGenreOf(category.type, slug));
  return [...new Set(known)];
}

function parseMinScore(params: BrowseSearchParams): ScoreThreshold | undefined {
  const minQuality = Number(firstValue(params[PARAMS.minQuality]));
  return SCORE_THRESHOLDS.find((score) => score * QUALITY_PER_SCORE_POINT === minQuality);
}

export function parseBrowseState(
  category: BrowseCategory,
  params: BrowseSearchParams,
  currentYear: number,
): BrowseState {
  const requestedSort = firstValue(params[PARAMS.sort]);
  const sort = sortsFor(category).find((option) => option === requestedSort) ?? 'recommended';
  if (!category.isFilterable) return { sort, filters: NO_FILTERS };

  return {
    sort,
    filters: {
      genres: parseGenres(category, params),
      ...parseYearRange(params, currentYear),
      minScore: parseMinScore(params),
    },
  };
}

export function activeFilterCount(filters: BrowseFilters): number {
  return (
    filters.genres.length +
    (hasYearRange(filters) ? 1 : 0) +
    (filters.minScore === undefined ? 0 : 1)
  );
}

export function browseSearchParams({ sort, filters }: BrowseState): URLSearchParams {
  const params = new URLSearchParams();
  if (sort !== 'recommended') params.set(PARAMS.sort, sort);
  if (filters.genres.length > 0) params.set(PARAMS.genres, filters.genres.join(LIST_SEPARATOR));
  if (filters.yearFrom !== undefined) params.set(PARAMS.yearFrom, String(filters.yearFrom));
  if (filters.yearTo !== undefined) params.set(PARAMS.yearTo, String(filters.yearTo));
  if (filters.minScore !== undefined) {
    params.set(PARAMS.minQuality, String(filters.minScore * QUALITY_PER_SCORE_POINT));
  }
  return params;
}

export function browseHref(slug: BrowseCategorySlug, state: BrowseState): string {
  const query = browseSearchParams(state).toString();
  return `${BROWSE_ROUTE}/${slug}${query ? `?${query}` : ''}`;
}

export function carryStateTo(target: BrowseCategory, { sort, filters }: BrowseState): BrowseState {
  const carriedSort = sortsFor(target).includes(sort) ? sort : 'recommended';
  if (!target.isFilterable) return { sort: carriedSort, filters: NO_FILTERS };
  return {
    sort: carriedSort,
    filters: { ...filters, genres: filters.genres.filter((slug) => isGenreOf(target.type, slug)) },
  };
}

export function toCatalogQuery(
  { sort, filters }: BrowseState,
  page: { offset: number; limit: number },
): CatalogListQuery {
  return {
    ...page,
    sort: sort === 'recommended' ? undefined : sort,
    genres: filters.genres.length > 0 ? filters.genres.join(LIST_SEPARATOR) : undefined,
    yearFrom: filters.yearFrom,
    yearTo: filters.yearTo,
    minQuality:
      filters.minScore === undefined ? undefined : filters.minScore * QUALITY_PER_SCORE_POINT,
  };
}
