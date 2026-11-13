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

type FilterQuery = Omit<CatalogListQuery, 'limit' | 'offset'>;

const DEFAULT_SORT = 'recommended' satisfies BrowseSort;
export const NO_FILTERS: BrowseFilters = { genres: [] };
export const DEFAULT_BROWSE_STATE: BrowseState = { sort: DEFAULT_SORT, filters: NO_FILTERS };

export const BROWSE_PAGE_SIZE = 24;

const QUALITY_PER_SCORE_POINT = 10;
const API_EARLIEST_YEAR = 1900;
const API_LATEST_YEAR = 2100;
const LATEST_YEAR_AHEAD = 10;
const LIST_SEPARATOR = ',';

export function sortsFor(category: BrowseCategory): BrowseSort[] {
  return category.type === 'show'
    ? ['recommended', 'releaseDate', 'lastAirDate']
    : ['recommended', 'releaseDate'];
}

function toMinQuality(score: ScoreThreshold): number {
  return score * QUALITY_PER_SCORE_POINT;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseYear(value: string | undefined, currentYear: number): number | undefined {
  const year = Number(value);
  const latest = Math.min(API_LATEST_YEAR, currentYear + LATEST_YEAR_AHEAD);
  return Number.isInteger(year) && year >= API_EARLIEST_YEAR && year <= latest ? year : undefined;
}

function parseYearRange(params: BrowseSearchParams, currentYear: number): YearRange {
  const yearFrom = parseYear(firstValue(params.yearFrom), currentYear);
  const yearTo = parseYear(firstValue(params.yearTo), currentYear);
  if (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) return {};
  return { yearFrom, yearTo };
}

function parseGenres(category: BrowseCategory, params: BrowseSearchParams): GenreSlug[] {
  const requested = firstValue(params.genres)?.split(LIST_SEPARATOR) ?? [];
  const known = requested.filter((slug): slug is GenreSlug => isGenreOf(category.type, slug));
  return [...new Set(known)];
}

function parseMinScore(params: BrowseSearchParams): ScoreThreshold | undefined {
  const minQuality = Number(firstValue(params.minQuality));
  return SCORE_THRESHOLDS.find((score) => toMinQuality(score) === minQuality);
}

export function parseBrowseState(
  category: BrowseCategory,
  params: BrowseSearchParams,
  currentYear: number,
): BrowseState {
  const requestedSort = firstValue(params.sort);
  const sort = sortsFor(category).find((option) => option === requestedSort) ?? DEFAULT_SORT;
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

function toFilterQuery({ sort, filters }: BrowseState): FilterQuery {
  return {
    sort: sort === DEFAULT_SORT ? undefined : sort,
    genres: filters.genres.length > 0 ? filters.genres.join(LIST_SEPARATOR) : undefined,
    yearFrom: filters.yearFrom,
    yearTo: filters.yearTo,
    minQuality: filters.minScore === undefined ? undefined : toMinQuality(filters.minScore),
  };
}

export function browseSearchParams(state: BrowseState): URLSearchParams {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(toFilterQuery(state))) {
    if (value !== undefined) params.set(name, String(value));
  }
  return params;
}

export function browseStateKey(state: BrowseState): string {
  return browseSearchParams(state).toString();
}

export function browseHref(slug: BrowseCategorySlug, state: BrowseState): string {
  const query = browseStateKey(state);
  return `${BROWSE_ROUTE}/${slug}${query ? `?${query}` : ''}`;
}

export function carryStateTo(target: BrowseCategory, { sort, filters }: BrowseState): BrowseState {
  const carriedSort = sortsFor(target).includes(sort) ? sort : DEFAULT_SORT;
  if (!target.isFilterable) return { sort: carriedSort, filters: NO_FILTERS };
  return {
    sort: carriedSort,
    filters: { ...filters, genres: filters.genres.filter((slug) => isGenreOf(target.type, slug)) },
  };
}

export function toCatalogQuery(
  state: BrowseState,
  page: { offset: number; limit: number },
): CatalogListQuery {
  return { ...page, ...toFilterQuery(state) };
}
