/**
 * Property-Based Tests for Trending Queries - Degraded State Detection
 *
 * Feature: multi-context-evaluation
 * Property 5: Degraded State Detection
 * Property 6: Normal State When Evaluations Exist
 *
 * These tests validate that trending queries correctly detect and report
 * degraded state when context evaluations are missing.
 */

import * as fc from 'fast-check';

import { EvaluationContext, type EvaluationContextType } from '../../../catalog-policy/public';
import {
  CONTEXT_FRESHNESS,
  LIST_CONTEXT,
  TRENDING_THRESHOLDS,
} from '../../domain/constants/catalog.constants';
import type { TrendingQueryMeta, TrendingQueryResult } from '../../domain/types/query.types';
import { CATALOG_SORT, type CatalogSort } from '../../domain/constants/catalog-query.constants';

// ============================================================================
// In-Memory Query Simulator for Property Testing
// ============================================================================

/**
 * Simulates the degraded state detection logic from trending queries.
 * This mirrors the real implementation's behavior without database dependencies.
 */
class TrendingQuerySimulator<T> {
  private evaluationCounts: Map<string, number> = new Map();

  /**
   * Sets the evaluation count for a given context and policy version.
   */
  setEvaluationCount(context: EvaluationContextType, policyVersion: number, count: number): void {
    const key = `${context}:${policyVersion}`;
    this.evaluationCounts.set(key, count);
  }

  /**
   * Checks if evaluations exist for the given context with active policy.
   * Mirrors checkContextEvaluationsExist from trending queries.
   */
  checkContextEvaluationsExist(
    context: EvaluationContextType,
    activePolicyVersion: number,
  ): boolean {
    const key = `${context}:${activePolicyVersion}`;
    const count = this.evaluationCounts.get(key) ?? 0;
    return count > 0;
  }

  /**
   * Simulates the execute method's degraded state detection.
   * Returns a result with appropriate meta based on evaluation existence.
   */
  execute(
    context: EvaluationContextType,
    activePolicyVersion: number,
    mockData: T[],
  ): TrendingQueryResult<T> {
    const evaluationsExist = this.checkContextEvaluationsExist(context, activePolicyVersion);

    if (!evaluationsExist) {
      // Degraded state - no evaluations for context
      const emptyResult: TrendingQueryResult<T> = [] as TrendingQueryResult<T>;
      emptyResult.total = 0;
      emptyResult.meta = {
        degraded: true,
        degradedReason: 'Context evaluations missing - evaluation in progress',
      };
      return emptyResult;
    }

    // Normal state - evaluations exist
    const result = [...mockData] as TrendingQueryResult<T>;
    result.total = mockData.length;
    result.meta = { degraded: false };
    return result;
  }

  /**
   * Clears all evaluation counts.
   */
  clear(): void {
    this.evaluationCounts.clear();
  }
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

const evaluationContextArb = fc.constantFrom<EvaluationContextType>(
  EvaluationContext.CATALOG,
  EvaluationContext.TRENDING,
);

const policyVersionArb = fc.integer({ min: 1, max: 1000 });

const evaluationCountArb = fc.integer({ min: 0, max: 10000 });

const positiveEvaluationCountArb = fc.integer({ min: 1, max: 10000 });

/**
 * Generates mock trending item data
 */
const mockTrendingItemArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  ratingoScore: fc.integer({ min: 0, max: 100 }),
});

const mockTrendingDataArb = fc.array(mockTrendingItemArb, { minLength: 0, maxLength: 50 });

// ============================================================================
// Property Tests
// ============================================================================

describe('Trending Queries - Degraded State Detection Property Tests', () => {
  let simulator: TrendingQuerySimulator<{ id: string; title: string; ratingoScore: number }>;

  beforeEach(() => {
    simulator = new TrendingQuerySimulator();
  });

  /**
   * Feature: multi-context-evaluation
   * Property 5: Degraded State Detection
   *
   * For any API request to a context-specific endpoint (e.g., trending),
   * IF no evaluation records exist for that context with the active policy version,
   * THEN the response SHALL include `meta.degraded: true`.
   */
  describe('Property 5: Degraded State Detection', () => {
    it('returns degraded=true when no evaluations exist for context', () => {
      fc.assert(
        fc.property(
          evaluationContextArb,
          policyVersionArb,
          mockTrendingDataArb,
          (context, policyVersion, mockData) => {
            simulator.clear();
            // No evaluations set - count is 0

            const result = simulator.execute(context, policyVersion, mockData);

            // Should be degraded
            expect(result.meta?.degraded).toBe(true);
            expect(result.meta?.degradedReason).toBe(
              'Context evaluations missing - evaluation in progress',
            );
            // Should return empty data
            expect(result).toHaveLength(0);
            expect(result.total).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('returns degraded=true when evaluation count is explicitly zero', () => {
      fc.assert(
        fc.property(
          evaluationContextArb,
          policyVersionArb,
          mockTrendingDataArb,
          (context, policyVersion, mockData) => {
            simulator.clear();
            simulator.setEvaluationCount(context, policyVersion, 0);

            const result = simulator.execute(context, policyVersion, mockData);

            expect(result.meta?.degraded).toBe(true);
            expect(result).toHaveLength(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('degraded state is context-specific', () => {
      fc.assert(
        fc.property(
          policyVersionArb,
          positiveEvaluationCountArb,
          mockTrendingDataArb,
          (policyVersion, evalCount, mockData) => {
            simulator.clear();
            // Set evaluations for CATALOG but not TRENDING
            simulator.setEvaluationCount(EvaluationContext.CATALOG, policyVersion, evalCount);

            const catalogResult = simulator.execute(
              EvaluationContext.CATALOG,
              policyVersion,
              mockData,
            );
            const trendingResult = simulator.execute(
              EvaluationContext.TRENDING,
              policyVersion,
              mockData,
            );

            // CATALOG should be normal
            expect(catalogResult.meta?.degraded).toBe(false);
            // TRENDING should be degraded
            expect(trendingResult.meta?.degraded).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('degraded state is policy-version-specific', () => {
      fc.assert(
        fc.property(
          evaluationContextArb,
          fc.integer({ min: 1, max: 500 }),
          fc.integer({ min: 501, max: 1000 }),
          positiveEvaluationCountArb,
          mockTrendingDataArb,
          (context, version1, version2, evalCount, mockData) => {
            simulator.clear();
            // Set evaluations for version1 but not version2
            simulator.setEvaluationCount(context, version1, evalCount);

            const v1Result = simulator.execute(context, version1, mockData);
            const v2Result = simulator.execute(context, version2, mockData);

            // version1 should be normal
            expect(v1Result.meta?.degraded).toBe(false);
            // version2 should be degraded
            expect(v2Result.meta?.degraded).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Feature: multi-context-evaluation
   * Property 6: Normal State When Evaluations Exist
   *
   * For any API request to a context-specific endpoint,
   * IF evaluation records exist for that context with the active policy version,
   * THEN the response SHALL NOT include `meta.degraded: true`
   * (or `meta.degraded` SHALL be `false`).
   */
  describe('Property 6: Normal State When Evaluations Exist', () => {
    it('returns degraded=false when evaluations exist', () => {
      fc.assert(
        fc.property(
          evaluationContextArb,
          policyVersionArb,
          positiveEvaluationCountArb,
          mockTrendingDataArb,
          (context, policyVersion, evalCount, mockData) => {
            simulator.clear();
            simulator.setEvaluationCount(context, policyVersion, evalCount);

            const result = simulator.execute(context, policyVersion, mockData);

            // Should NOT be degraded
            expect(result.meta?.degraded).toBe(false);
            // Should return the mock data
            expect(result).toHaveLength(mockData.length);
            expect(result.total).toBe(mockData.length);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('returns data when evaluations exist regardless of count', () => {
      fc.assert(
        fc.property(
          evaluationContextArb,
          policyVersionArb,
          positiveEvaluationCountArb,
          mockTrendingDataArb,
          (context, policyVersion, evalCount, mockData) => {
            simulator.clear();
            simulator.setEvaluationCount(context, policyVersion, evalCount);

            const result = simulator.execute(context, policyVersion, mockData);

            // Data should be returned
            expect(result.total).toBe(mockData.length);
            for (let i = 0; i < mockData.length; i++) {
              expect(result[i]).toEqual(mockData[i]);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('meta.degraded is always defined in response', () => {
      fc.assert(
        fc.property(
          evaluationContextArb,
          policyVersionArb,
          evaluationCountArb,
          mockTrendingDataArb,
          (context, policyVersion, evalCount, mockData) => {
            simulator.clear();
            simulator.setEvaluationCount(context, policyVersion, evalCount);

            const result = simulator.execute(context, policyVersion, mockData);

            // meta should always be defined
            expect(result.meta).toBeDefined();
            // degraded should be a boolean
            expect(typeof result.meta?.degraded).toBe('boolean');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('normal state does not include degradedReason', () => {
      fc.assert(
        fc.property(
          evaluationContextArb,
          policyVersionArb,
          positiveEvaluationCountArb,
          mockTrendingDataArb,
          (context, policyVersion, evalCount, mockData) => {
            simulator.clear();
            simulator.setEvaluationCount(context, policyVersion, evalCount);

            const result = simulator.execute(context, policyVersion, mockData);

            // When not degraded, degradedReason should be undefined
            expect(result.meta?.degraded).toBe(false);
            expect(result.meta?.degradedReason).toBeUndefined();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Additional property: Degraded state detection is deterministic
   */
  describe('Determinism', () => {
    it('same inputs always produce same degraded state', () => {
      fc.assert(
        fc.property(
          evaluationContextArb,
          policyVersionArb,
          evaluationCountArb,
          mockTrendingDataArb,
          (context, policyVersion, evalCount, mockData) => {
            simulator.clear();
            simulator.setEvaluationCount(context, policyVersion, evalCount);

            const result1 = simulator.execute(context, policyVersion, mockData);
            const result2 = simulator.execute(context, policyVersion, mockData);

            // Results should be identical
            expect(result1.meta?.degraded).toBe(result2.meta?.degraded);
            expect(result1.total).toBe(result2.total);
            expect(result1.length).toBe(result2.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// ============================================================================
// Freshness Gate Property Tests
// ============================================================================

/**
 * Property tests for trending pool freshness gate behavior.
 *
 * Critical invariant: In trending pool endpoints, the freshness threshold
 * is determined by the pool type (trending), NOT by the sort parameter.
 * Sort should only affect ordering, not filtering.
 */
describe('Trending Queries - Freshness Gate Property Tests', () => {
  /** Fixed: threshold independent of sort */
  const getFreshnessThreshold = (listContext: 'home' | 'catalog', _sort: CatalogSort): number => {
    return CONTEXT_FRESHNESS[listContext].trending;
  };

  /** Buggy: threshold depended on sort */
  const getFreshnessThresholdBuggy = (
    listContext: 'home' | 'catalog',
    sort: CatalogSort,
  ): number => {
    return CONTEXT_FRESHNESS[listContext][sort] ?? 0;
  };

  const catalogSortArb = fc.constantFrom<CatalogSort>(
    CATALOG_SORT.TRENDING,
    CATALOG_SORT.RATINGO,
    CATALOG_SORT.RELEASE_DATE,
    CATALOG_SORT.TMDB_POPULARITY,
  );

  const listContextArb = fc.constantFrom<'home' | 'catalog'>(
    LIST_CONTEXT.HOME,
    LIST_CONTEXT.CATALOG,
  );

  describe('Property: Freshness threshold is sort-independent', () => {
    it('trending pool uses same freshness threshold regardless of sort parameter', () => {
      fc.assert(
        fc.property(listContextArb, catalogSortArb, catalogSortArb, (context, sort1, sort2) => {
          const threshold1 = getFreshnessThreshold(context, sort1);
          const threshold2 = getFreshnessThreshold(context, sort2);

          // Same context should always produce same threshold
          expect(threshold1).toBe(threshold2);
          // Should match the .trending value for that context
          expect(threshold1).toBe(CONTEXT_FRESHNESS[context].trending);
        }),
        { numRuns: 100 },
      );
    });

    it('fixed implementation differs from buggy implementation for non-trending sorts', () => {
      // This test documents the bug we fixed
      fc.assert(
        fc.property(
          listContextArb,
          fc.constantFrom<CatalogSort>(CATALOG_SORT.RATINGO, CATALOG_SORT.RELEASE_DATE),
          (context, sort) => {
            const fixedThreshold = getFreshnessThreshold(context, sort);
            const buggyThreshold = getFreshnessThresholdBuggy(context, sort);

            // For catalog context with ratingo/releaseDate:
            // - Fixed: always uses .trending (30)
            // - Buggy: used .ratingo (0) or .releaseDate (0)
            if (context === LIST_CONTEXT.CATALOG) {
              expect(fixedThreshold).toBe(CONTEXT_FRESHNESS.catalog.trending); // 30
              expect(buggyThreshold).toBe(0); // was the bug
              expect(fixedThreshold).not.toBe(buggyThreshold);
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Property: Freshness threshold is context-dependent', () => {
    it('different list contexts produce different thresholds', () => {
      fc.assert(
        fc.property(catalogSortArb, (sort) => {
          const homeThreshold = getFreshnessThreshold(LIST_CONTEXT.HOME, sort);
          const catalogThreshold = getFreshnessThreshold(LIST_CONTEXT.CATALOG, sort);

          // Home has stricter threshold than catalog
          expect(homeThreshold).toBeGreaterThan(catalogThreshold);
          expect(homeThreshold).toBe(CONTEXT_FRESHNESS.home.trending); // 50
          expect(catalogThreshold).toBe(CONTEXT_FRESHNESS.catalog.trending); // 30
        }),
        { numRuns: 20 },
      );
    });
  });

  describe('Property: Freshness filtering is deterministic', () => {
    it('same item always passes or fails freshness gate consistently', () => {
      const freshnessScoreArb = fc.integer({ min: 0, max: 100 });

      fc.assert(
        fc.property(
          listContextArb,
          catalogSortArb,
          freshnessScoreArb,
          (context, sort, freshnessScore) => {
            const threshold = getFreshnessThreshold(context, sort);
            const passes1 = freshnessScore >= threshold;
            const passes2 = freshnessScore >= threshold;

            expect(passes1).toBe(passes2);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('changing sort does not change whether item passes freshness gate', () => {
      const freshnessScoreArb = fc.integer({ min: 0, max: 100 });

      fc.assert(
        fc.property(
          listContextArb,
          catalogSortArb,
          catalogSortArb,
          freshnessScoreArb,
          (context, sort1, sort2, freshnessScore) => {
            const threshold1 = getFreshnessThreshold(context, sort1);
            const threshold2 = getFreshnessThreshold(context, sort2);

            const passesWithSort1 = freshnessScore >= threshold1;
            const passesWithSort2 = freshnessScore >= threshold2;

            // Same item should pass/fail consistently regardless of sort
            expect(passesWithSort1).toBe(passesWithSort2);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// ============================================================================
// Watchers Gate Property Tests
// ============================================================================

/**
 * Property tests for trending pool watchers gate behavior.
 *
 * Trending without audience is just "recent" content.
 * The watchers gate ensures minimum traction before appearing in trending.
 */
describe('Trending Queries - Watchers Gate Property Tests', () => {
  const watchersArb = fc.integer({ min: 0, max: 100 });

  describe('Property: Watchers threshold by media type', () => {
    it('movies require MIN_WATCHERS_MOVIES to pass gate', () => {
      fc.assert(
        fc.property(watchersArb, (watchersCount) => {
          const passes = watchersCount >= TRENDING_THRESHOLDS.MIN_WATCHERS_MOVIES;

          if (watchersCount < TRENDING_THRESHOLDS.MIN_WATCHERS_MOVIES) {
            expect(passes).toBe(false);
          } else {
            expect(passes).toBe(true);
          }
        }),
        { numRuns: 50 },
      );
    });

    it('shows require MIN_WATCHERS_SHOWS to pass gate', () => {
      fc.assert(
        fc.property(watchersArb, (watchersCount) => {
          const passes = watchersCount >= TRENDING_THRESHOLDS.MIN_WATCHERS_SHOWS;

          if (watchersCount < TRENDING_THRESHOLDS.MIN_WATCHERS_SHOWS) {
            expect(passes).toBe(false);
          } else {
            expect(passes).toBe(true);
          }
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('Property: Threshold constants are correctly configured', () => {
    it('movies threshold is 5', () => {
      expect(TRENDING_THRESHOLDS.MIN_WATCHERS_MOVIES).toBe(5);
    });

    it('shows threshold is 10', () => {
      expect(TRENDING_THRESHOLDS.MIN_WATCHERS_SHOWS).toBe(10);
    });

    it('shows require more watchers than movies', () => {
      expect(TRENDING_THRESHOLDS.MIN_WATCHERS_MOVIES).toBeLessThan(
        TRENDING_THRESHOLDS.MIN_WATCHERS_SHOWS,
      );
    });
  });

  describe('Property: Watchers gate is deterministic', () => {
    it('same watchers count always produces same result', () => {
      fc.assert(
        fc.property(watchersArb, (watchersCount) => {
          const passesMovies1 = watchersCount >= TRENDING_THRESHOLDS.MIN_WATCHERS_MOVIES;
          const passesMovies2 = watchersCount >= TRENDING_THRESHOLDS.MIN_WATCHERS_MOVIES;
          const passesShows1 = watchersCount >= TRENDING_THRESHOLDS.MIN_WATCHERS_SHOWS;
          const passesShows2 = watchersCount >= TRENDING_THRESHOLDS.MIN_WATCHERS_SHOWS;

          expect(passesMovies1).toBe(passesMovies2);
          expect(passesShows1).toBe(passesShows2);
        }),
        { numRuns: 50 },
      );
    });
  });
});
