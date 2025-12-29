/**
 * Classification Service Property-Based Tests
 *
 * Feature: content-classification
 * Validates: Requirements 2.1-2.6
 */

import * as fc from 'fast-check';
import {
  classifyContent,
  ClassificationInput,
  ContentClass,
  ContentClassValues,
  TMDB_GENRES,
  VALID_CONTENT_CLASSES,
  isValidContentClass,
} from './classification.service';

describe('Classification Service - Property-Based Tests', () => {
  // Arbitraries (generators)
  const countryCodeArb = fc.stringMatching(/^[A-Z]{2}$/);
  const languageCodeArb = fc.stringMatching(/^[a-z]{2}$/);

  const genreIdArb = fc.oneof(
    fc.constantFrom(
      TMDB_GENRES.ANIMATION,
      TMDB_GENRES.DOCUMENTARY,
      TMDB_GENRES.REALITY,
      TMDB_GENRES.KIDS,
      TMDB_GENRES.FAMILY,
    ),
    fc.constantFrom(
      28,
      12,
      16,
      35,
      80,
      99,
      18,
      10751,
      14,
      36,
      27,
      10402,
      9648,
      10749,
      878,
      10770,
      53,
      10752,
      37,
    ),
    fc.nat({ max: 20000 }),
  );

  const classificationInputArb: fc.Arbitrary<ClassificationInput> = fc.record({
    originCountries: fc.option(fc.array(countryCodeArb, { minLength: 0, maxLength: 5 }), {
      nil: null,
    }),
    originalLanguage: fc.option(languageCodeArb, { nil: null }),
    genreIds: fc.array(genreIdArb, { minLength: 0, maxLength: 10 }),
  });

  const animeInputArb: fc.Arbitrary<ClassificationInput> = fc.record({
    originCountries: fc.oneof(
      fc.constant(['JP'] as string[]),
      fc.constant(['JP', 'US'] as string[]),
      fc
        .array(countryCodeArb, { minLength: 0, maxLength: 3 })
        .map((countries) => ['JP', ...countries]),
    ),
    originalLanguage: fc.oneof(fc.constant('ja'), fc.constant('en'), languageCodeArb),
    genreIds: fc
      .array(genreIdArb, { minLength: 0, maxLength: 5 })
      .map((genres) => [TMDB_GENRES.ANIMATION, ...genres]),
  });

  const westernAnimationInputArb: fc.Arbitrary<ClassificationInput> = fc.record({
    originCountries: fc.array(
      countryCodeArb.filter((c) => c !== 'JP'),
      { minLength: 1, maxLength: 3 },
    ),
    originalLanguage: languageCodeArb.filter((l) => l !== 'ja'),
    genreIds: fc
      .array(genreIdArb, { minLength: 0, maxLength: 5 })
      .map((genres) => [TMDB_GENRES.ANIMATION, ...genres]),
  });

  // Property 1: Classification Determinism
  // Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
  describe('Property 1: Classification Determinism', () => {
    it('should produce identical results for identical inputs', () => {
      fc.assert(
        fc.property(classificationInputArb, (input) => {
          const result1 = classifyContent(input);
          const result2 = classifyContent(input);

          // Results should be identical
          expect(result1).toBe(result2);
        }),
        { numRuns: 100 },
      );
    });

    it('should produce identical results when called multiple times in sequence', () => {
      fc.assert(
        fc.property(classificationInputArb, (input) => {
          const results: ContentClass[] = [];

          // Call 5 times
          for (let i = 0; i < 5; i++) {
            results.push(classifyContent(input));
          }

          // All results should be identical
          const firstResult = results[0];
          expect(results.every((r) => r === firstResult)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should produce identical results when called in different order with other inputs', () => {
      fc.assert(
        fc.property(
          classificationInputArb,
          classificationInputArb,
          classificationInputArb,
          (input1, input2, input3) => {
            // Evaluate in order: input1, input2, input3, input1 again
            const result1a = classifyContent(input1);
            classifyContent(input2);
            classifyContent(input3);
            const result1b = classifyContent(input1);

            // First and last evaluations of input1 should be identical
            expect(result1a).toBe(result1b);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Property: Output is Always Valid ContentClass
  describe('Property: Output is Always Valid ContentClass', () => {
    it('should always return a valid ContentClass value', () => {
      fc.assert(
        fc.property(classificationInputArb, (input) => {
          const result = classifyContent(input);

          // Result must be one of the valid content classes
          expect(VALID_CONTENT_CLASSES).toContain(result);
          expect(isValidContentClass(result)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should return one of exactly 5 possible values', () => {
      fc.assert(
        fc.property(classificationInputArb, (input) => {
          const result = classifyContent(input);

          const validValues: ContentClass[] = [
            ContentClassValues.MAINSTREAM,
            ContentClassValues.ANIME,
            ContentClassValues.DOCUMENTARY,
            ContentClassValues.REALITY,
            ContentClassValues.KIDS,
          ];

          expect(validValues).toContain(result);
        }),
        { numRuns: 100 },
      );
    });
  });

  // Property: Anime Classification Rules
  describe('Property: Anime Classification Rules', () => {
    it('should classify Animation + JP origin as anime', () => {
      fc.assert(
        fc.property(animeInputArb, (input) => {
          // Ensure JP is in origin countries
          if (input.originCountries?.includes('JP')) {
            const result = classifyContent(input);
            expect(result).toBe(ContentClassValues.ANIME);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should classify Animation + ja language as anime', () => {
      fc.assert(
        fc.property(
          fc.record({
            originCountries: fc.option(
              fc.array(
                countryCodeArb.filter((c) => c !== 'JP'),
                { minLength: 0, maxLength: 3 },
              ),
              { nil: null },
            ),
            originalLanguage: fc.constant('ja'),
            genreIds: fc
              .array(genreIdArb, { minLength: 0, maxLength: 5 })
              .map((genres) => [TMDB_GENRES.ANIMATION, ...genres]),
          }),
          (input) => {
            const result = classifyContent(input);
            expect(result).toBe(ContentClassValues.ANIME);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should NOT classify Animation without JP/ja as anime', () => {
      fc.assert(
        fc.property(westernAnimationInputArb, (input) => {
          const result = classifyContent(input);
          expect(result).not.toBe(ContentClassValues.ANIME);
        }),
        { numRuns: 100 },
      );
    });
  });

  // Property: Documentary Classification
  describe('Property: Documentary Classification', () => {
    it('should classify Documentary genre as documentary (unless anime takes priority)', () => {
      fc.assert(
        fc.property(
          fc.record({
            originCountries: fc.option(
              fc.array(
                countryCodeArb.filter((c) => c !== 'JP'),
                { minLength: 0, maxLength: 3 },
              ),
              { nil: null },
            ),
            originalLanguage: fc.option(
              languageCodeArb.filter((l) => l !== 'ja'),
              { nil: null },
            ),
            genreIds: fc
              .array(genreIdArb, { minLength: 0, maxLength: 5 })
              .map((genres) => [
                TMDB_GENRES.DOCUMENTARY,
                ...genres.filter((g) => g !== TMDB_GENRES.ANIMATION),
              ]),
          }),
          (input) => {
            const result = classifyContent(input);
            expect(result).toBe(ContentClassValues.DOCUMENTARY);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Property: Reality Classification
  describe('Property: Reality Classification', () => {
    it('should classify Reality genre as reality (unless higher priority takes precedence)', () => {
      fc.assert(
        fc.property(
          fc.record({
            originCountries: fc.option(
              fc.array(
                countryCodeArb.filter((c) => c !== 'JP'),
                { minLength: 0, maxLength: 3 },
              ),
              { nil: null },
            ),
            originalLanguage: fc.option(
              languageCodeArb.filter((l) => l !== 'ja'),
              { nil: null },
            ),
            genreIds: fc
              .array(genreIdArb, { minLength: 0, maxLength: 5 })
              .map((genres) => [
                TMDB_GENRES.REALITY,
                ...genres.filter(
                  (g) => g !== TMDB_GENRES.ANIMATION && g !== TMDB_GENRES.DOCUMENTARY,
                ),
              ]),
          }),
          (input) => {
            const result = classifyContent(input);
            expect(result).toBe(ContentClassValues.REALITY);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Property: Kids Classification
  describe('Property: Kids Classification', () => {
    it('should classify Kids genre as kids (unless higher priority takes precedence)', () => {
      fc.assert(
        fc.property(
          fc.record({
            originCountries: fc.option(
              fc.array(
                countryCodeArb.filter((c) => c !== 'JP'),
                { minLength: 0, maxLength: 3 },
              ),
              { nil: null },
            ),
            originalLanguage: fc.option(
              languageCodeArb.filter((l) => l !== 'ja'),
              { nil: null },
            ),
            genreIds: fc
              .array(genreIdArb, { minLength: 0, maxLength: 5 })
              .map((genres) => [
                TMDB_GENRES.KIDS,
                ...genres.filter(
                  (g) =>
                    g !== TMDB_GENRES.ANIMATION &&
                    g !== TMDB_GENRES.DOCUMENTARY &&
                    g !== TMDB_GENRES.REALITY,
                ),
              ]),
          }),
          (input) => {
            const result = classifyContent(input);
            expect(result).toBe(ContentClassValues.KIDS);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should NOT classify Family genre as kids', () => {
      fc.assert(
        fc.property(
          fc.record({
            originCountries: fc.option(
              fc.array(
                countryCodeArb.filter((c) => c !== 'JP'),
                { minLength: 0, maxLength: 3 },
              ),
              { nil: null },
            ),
            originalLanguage: fc.option(
              languageCodeArb.filter((l) => l !== 'ja'),
              { nil: null },
            ),
            genreIds: fc.constant([TMDB_GENRES.FAMILY] as number[]),
          }),
          (input) => {
            const result = classifyContent(input);
            expect(result).toBe(ContentClassValues.MAINSTREAM);
            expect(result).not.toBe(ContentClassValues.KIDS);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Property: Default to Mainstream
  describe('Property: Default to Mainstream', () => {
    it('should default to mainstream when no classification rules match', () => {
      fc.assert(
        fc.property(
          fc.record({
            originCountries: fc.option(
              fc.array(
                countryCodeArb.filter((c) => c !== 'JP'),
                { minLength: 0, maxLength: 3 },
              ),
              { nil: null },
            ),
            originalLanguage: fc.option(
              languageCodeArb.filter((l) => l !== 'ja'),
              { nil: null },
            ),
            genreIds: fc.array(
              fc
                .nat({ max: 20000 })
                .filter(
                  (g) =>
                    g !== TMDB_GENRES.ANIMATION &&
                    g !== TMDB_GENRES.DOCUMENTARY &&
                    g !== TMDB_GENRES.REALITY &&
                    g !== TMDB_GENRES.KIDS,
                ),
              { minLength: 0, maxLength: 5 },
            ),
          }),
          (input) => {
            const result = classifyContent(input);
            expect(result).toBe(ContentClassValues.MAINSTREAM);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return mainstream for empty genres', () => {
      fc.assert(
        fc.property(
          fc.record({
            originCountries: fc.option(fc.array(countryCodeArb, { minLength: 0, maxLength: 3 }), {
              nil: null,
            }),
            originalLanguage: fc.option(languageCodeArb, { nil: null }),
            genreIds: fc.constant([] as number[]),
          }),
          (input) => {
            const result = classifyContent(input);
            expect(result).toBe(ContentClassValues.MAINSTREAM);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Property: Graceful Handling of Null/Undefined
  describe('Property: Graceful Handling of Null/Undefined', () => {
    it('should handle null originCountries gracefully', () => {
      fc.assert(
        fc.property(
          fc.record({
            originCountries: fc.constant(null),
            originalLanguage: fc.option(languageCodeArb, { nil: null }),
            genreIds: fc.array(genreIdArb, { minLength: 0, maxLength: 5 }),
          }),
          (input) => {
            // Should not throw
            const result = classifyContent(input);
            expect(VALID_CONTENT_CLASSES).toContain(result);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle null originalLanguage gracefully', () => {
      fc.assert(
        fc.property(
          fc.record({
            originCountries: fc.option(fc.array(countryCodeArb, { minLength: 0, maxLength: 3 }), {
              nil: null,
            }),
            originalLanguage: fc.constant(null),
            genreIds: fc.array(genreIdArb, { minLength: 0, maxLength: 5 }),
          }),
          (input) => {
            // Should not throw
            const result = classifyContent(input);
            expect(VALID_CONTENT_CLASSES).toContain(result);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle all null values gracefully', () => {
      fc.assert(
        fc.property(
          fc.record({
            originCountries: fc.constant(null),
            originalLanguage: fc.constant(null),
            genreIds: fc.array(genreIdArb, { minLength: 0, maxLength: 5 }),
          }),
          (input) => {
            // Should not throw
            const result = classifyContent(input);
            expect(VALID_CONTENT_CLASSES).toContain(result);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Property: Priority Order Consistency
  describe('Property: Priority Order Consistency', () => {
    it('should prioritize anime over documentary when both genres present with JP origin', () => {
      fc.assert(
        fc.property(
          fc.record({
            originCountries: fc.constant(['JP'] as string[]),
            originalLanguage: fc.oneof(fc.constant('ja'), fc.constant('en')),
            genreIds: fc.constant([TMDB_GENRES.ANIMATION, TMDB_GENRES.DOCUMENTARY] as number[]),
          }),
          (input) => {
            const result = classifyContent(input);
            expect(result).toBe(ContentClassValues.ANIME);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should prioritize documentary over reality when both genres present', () => {
      fc.assert(
        fc.property(
          fc.record({
            originCountries: fc.option(
              fc.array(
                countryCodeArb.filter((c) => c !== 'JP'),
                { minLength: 0, maxLength: 3 },
              ),
              { nil: null },
            ),
            originalLanguage: fc.option(
              languageCodeArb.filter((l) => l !== 'ja'),
              { nil: null },
            ),
            genreIds: fc.constant([TMDB_GENRES.DOCUMENTARY, TMDB_GENRES.REALITY] as number[]),
          }),
          (input) => {
            const result = classifyContent(input);
            expect(result).toBe(ContentClassValues.DOCUMENTARY);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should prioritize reality over kids when both genres present', () => {
      fc.assert(
        fc.property(
          fc.record({
            originCountries: fc.option(
              fc.array(
                countryCodeArb.filter((c) => c !== 'JP'),
                { minLength: 0, maxLength: 3 },
              ),
              { nil: null },
            ),
            originalLanguage: fc.option(
              languageCodeArb.filter((l) => l !== 'ja'),
              { nil: null },
            ),
            genreIds: fc.constant([TMDB_GENRES.REALITY, TMDB_GENRES.KIDS] as number[]),
          }),
          (input) => {
            const result = classifyContent(input);
            expect(result).toBe(ContentClassValues.REALITY);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
