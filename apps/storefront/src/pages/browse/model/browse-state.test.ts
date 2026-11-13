import fc from 'fast-check';
import { browseCategoriesOfType, findBrowseCategory, type BrowseCategory } from './browse-category';
import {
  NO_FILTERS,
  SCORE_THRESHOLDS,
  activeFilterCount,
  browseHref,
  browseSearchParams,
  carryStateTo,
  parseBrowseState,
  toCatalogQuery,
  type BrowseState,
} from './browse-state';
import { GENRE_SLUGS } from './genres';
import { yearPresets } from './year-presets';

const CURRENT_YEAR = 2026;

function category(slug: string): BrowseCategory {
  const found = findBrowseCategory(slug);
  if (!found) throw new Error(`Unknown category ${slug}`);
  return found;
}

function paramsOf(state: BrowseState): Record<string, string> {
  return Object.fromEntries(browseSearchParams(state));
}

const filterableCategory = fc.constantFrom(
  ...[...browseCategoriesOfType('show'), ...browseCategoriesOfType('movie')].filter(
    (candidate) => candidate.isFilterable,
  ),
);

const browseStateFor = (target: BrowseCategory) =>
  fc.record({
    sort: fc.constantFrom(
      ...(target.type === 'show'
        ? (['recommended', 'releaseDate', 'lastAirDate'] as const)
        : (['recommended', 'releaseDate'] as const)),
    ),
    filters: fc.record({
      genres: fc.uniqueArray(fc.constantFrom(...GENRE_SLUGS[target.type]), { maxLength: 4 }),
      preset: fc.option(fc.constantFrom(...yearPresets(CURRENT_YEAR)), { nil: undefined }),
      minScore: fc.option(fc.constantFrom(...SCORE_THRESHOLDS), { nil: undefined }),
    }),
  });

describe('parseBrowseState', () => {
  it('round-trips every state it serializes', () => {
    fc.assert(
      fc.property(
        filterableCategory.chain((target) => fc.tuple(fc.constant(target), browseStateFor(target))),
        ([target, { sort, filters }]) => {
          const state: BrowseState = {
            sort,
            filters: {
              genres: filters.genres,
              yearFrom: filters.preset?.yearFrom,
              yearTo: filters.preset?.yearTo,
              minScore: filters.minScore,
            },
          };
          expect(parseBrowseState(target, paramsOf(state), CURRENT_YEAR)).toEqual(state);
        },
      ),
    );
  });

  it('keeps a future decade end so the decade preset still matches', () => {
    const state = parseBrowseState(
      category('movies-trending'),
      { yearFrom: '2020', yearTo: '2029' },
      CURRENT_YEAR,
    );
    expect(state.filters).toMatchObject({ yearFrom: 2020, yearTo: 2029 });
  });

  it('drops unknown genres, invalid years, odd scores and foreign sorts', () => {
    const state = parseBrowseState(
      category('movies-popular'),
      {
        genres: 'drama,unknown,realiti-shou,drama',
        yearFrom: '2030',
        yearTo: '2001',
        minQuality: '75',
        sort: 'lastAirDate',
      },
      CURRENT_YEAR,
    );
    expect(state).toEqual({
      sort: 'recommended',
      filters: { genres: ['drama'], yearFrom: undefined, yearTo: undefined, minScore: undefined },
    });
  });

  it('accepts legacy sort=ratingo links as the recommended order', () => {
    expect(parseBrowseState(category('shows-trending'), { sort: 'ratingo' }, CURRENT_YEAR).sort).toBe(
      'recommended',
    );
  });

  it('ignores filters on collections that only sort', () => {
    const state = parseBrowseState(
      category('movies-now-playing'),
      { genres: 'drama', minQuality: '70', sort: 'releaseDate' },
      CURRENT_YEAR,
    );
    expect(state).toEqual({ sort: 'releaseDate', filters: NO_FILTERS });
  });
});

describe('browse URLs and API queries', () => {
  const state: BrowseState = {
    sort: 'releaseDate',
    filters: { genres: ['drama', 'kryminal'], yearFrom: 2020, yearTo: 2029, minScore: 7 },
  };

  it('builds a shareable href with API-style params', () => {
    expect(browseHref('shows-popular', state)).toBe(
      '/browse/shows-popular?sort=releaseDate&genres=drama%2Ckryminal&yearFrom=2020&yearTo=2029&minQuality=70',
    );
    expect(browseHref('shows-trending', { sort: 'recommended', filters: NO_FILTERS })).toBe(
      '/browse/shows-trending',
    );
  });

  it('maps the score threshold to the quality scale and leaves the default order unsent', () => {
    expect(toCatalogQuery(state, { offset: 24, limit: 24 })).toEqual({
      offset: 24,
      limit: 24,
      sort: 'releaseDate',
      genres: 'drama,kryminal',
      yearFrom: 2020,
      yearTo: 2029,
      minQuality: 70,
    });
    expect(
      toCatalogQuery({ sort: 'recommended', filters: NO_FILTERS }, { offset: 0, limit: 1 }).sort,
    ).toBeUndefined();
  });

  it('counts each genre plus the year range and the score as active filters', () => {
    expect(activeFilterCount(state.filters)).toBe(4);
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
  });

  it('carries only what the target collection understands', () => {
    const carried = carryStateTo(category('movies-trending'), {
      sort: 'lastAirDate',
      filters: { genres: ['drama', 'realiti-shou'], minScore: 8 },
    });
    expect(carried).toEqual({ sort: 'recommended', filters: { genres: ['drama'], minScore: 8 } });
    expect(carryStateTo(category('movies-digital'), state)).toEqual({
      sort: 'releaseDate',
      filters: NO_FILTERS,
    });
  });
});
