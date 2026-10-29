/**
 * Policy Input Mapper Tests
 */

import * as fc from 'fast-check';

import { type MediaItemRow, mapRowToPolicyEngineInput } from './policy-input.mapper';
import { computeRelevance } from '../../domain/policy-engine';
import { checkLocalMaturityOverride } from '../../domain/gates/global-requirements.gate';
import { type PolicyConfig } from '../../domain/types/policy.types';

const createRow = (overrides: Partial<MediaItemRow> = {}): MediaItemRow => ({
  id: 'media-1',
  title: 'Test',
  overview: 'Overview',
  originCountries: ['US'],
  originalLanguage: 'en',
  contentClass: 'mainstream',
  ratingImdb: null,
  ratingMetacritic: null,
  ratingRottenTomatoes: null,
  ratingTrakt: null,
  voteCountImdb: null,
  voteCountTrakt: null,
  qualityScore: null,
  popularityScore: null,
  freshnessScore: null,
  ratingoScore: null,
  watchersCount: null,
  ...overrides,
});

describe('mapRowToPolicyEngineInput - stats', () => {
  it('should return null stats when the media_stats row is absent (all stats null)', () => {
    const input = mapRowToPolicyEngineInput(createRow());

    expect(input.stats).toBeNull();
  });

  it('should keep stats when qualityScore is null but freshness and watchers exist', () => {
    const input = mapRowToPolicyEngineInput(
      createRow({ qualityScore: null, freshnessScore: 80, watchersCount: 25 }),
    );

    expect(input.stats).toEqual({
      qualityScore: null,
      popularityScore: null,
      freshnessScore: 0.8,
      ratingoScore: null,
      watchersCount: 25,
    });
  });

  it('should keep stats when only watchersCount is present', () => {
    const input = mapRowToPolicyEngineInput(createRow({ watchersCount: 0 }));

    expect(input.stats).not.toBeNull();
    expect(input.stats?.watchersCount).toBe(0);
  });

  it('should normalize 0-100 scores to 0-1 and leave watchersCount raw', () => {
    const input = mapRowToPolicyEngineInput(
      createRow({
        qualityScore: 50,
        popularityScore: 25,
        freshnessScore: 100,
        ratingoScore: 10,
        watchersCount: 7,
      }),
    );

    expect(input.stats).toEqual({
      qualityScore: 0.5,
      popularityScore: 0.25,
      freshnessScore: 1,
      ratingoScore: 0.1,
      watchersCount: 7,
    });
  });

  it('should let localMaturityOverride succeed for items without a qualityScore', () => {
    const input = mapRowToPolicyEngineInput(
      createRow({ qualityScore: null, freshnessScore: 90, watchersCount: 50 }),
    );

    expect(
      checkLocalMaturityOverride(input, { minFreshnessScoreNormalized: 0.5, minLocalWatchers: 10 }),
    ).toBe(true);
  });

  it('should compute relevance from freshness when qualityScore is null', () => {
    const input = mapRowToPolicyEngineInput(createRow({ qualityScore: null, freshnessScore: 100 }));

    // freshness weight 20% of 1.0 => 20
    expect(computeRelevance(input, {} as PolicyConfig)).toBe(20);
  });

  describe('property-based', () => {
    const nullableScore = fc.option(fc.integer({ min: 0, max: 100 }), { nil: null });
    const nullableCount = fc.option(fc.integer({ min: 0, max: 10_000 }), { nil: null });

    it('stats is null iff every stat column is null; otherwise nullable fields are preserved', () => {
      fc.assert(
        fc.property(
          nullableScore,
          nullableScore,
          nullableScore,
          nullableScore,
          nullableCount,
          (quality, popularity, freshness, ratingo, watchers) => {
            const input = mapRowToPolicyEngineInput(
              createRow({
                qualityScore: quality,
                popularityScore: popularity,
                freshnessScore: freshness,
                ratingoScore: ratingo,
                watchersCount: watchers,
              }),
            );
            const allNull = [quality, popularity, freshness, ratingo, watchers].every(
              (v) => v === null,
            );

            if (allNull) {
              expect(input.stats).toBeNull();
              return;
            }
            expect(input.stats).not.toBeNull();
            expect(input.stats?.qualityScore).toBe(quality === null ? null : quality / 100);
            expect(input.stats?.freshnessScore).toBe(freshness === null ? null : freshness / 100);
            expect(input.stats?.watchersCount).toBe(watchers);
          },
        ),
      );
    });
  });
});
