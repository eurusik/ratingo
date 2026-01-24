import { EligibilityStatus, EvaluationReason } from '../constants/evaluation.constants';
import { checkDataIntegrity } from './data-integrity.gate';
import type { PolicyEngineInput } from '../types/policy.types';

describe('DataIntegrityGate', () => {
  const createMediaItem = (
    overrides: Partial<PolicyEngineInput['mediaItem']> = {},
  ): PolicyEngineInput['mediaItem'] => ({
    id: 'test-id',
    originCountries: ['US'],
    originalLanguage: 'en',
    title: 'Test Movie',
    overview: 'Test overview',
    contentClass: 'mainstream',
    normalizedOffers: [],
    voteCountImdb: null,
    voteCountTrakt: null,
    ratingImdb: null,
    ratingMetacritic: null,
    ratingRottenTomatoes: null,
    ratingTrakt: null,
    ...overrides,
  });

  describe('checkDataIntegrity', () => {
    it('should pass when all required fields are present', () => {
      const result = checkDataIntegrity(createMediaItem());

      expect(result.passes).toBe(true);
      expect(result.evaluation).toBeNull();
    });

    describe('origin countries validation', () => {
      it('should fail when originCountries is null', () => {
        const result = checkDataIntegrity(createMediaItem({ originCountries: null }));

        expect(result.passes).toBe(false);
        expect(result.evaluation?.status).toBe(EligibilityStatus.INELIGIBLE);
        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_REQUIRED_METADATA);
        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_ORIGIN_COUNTRY);
      });

      it('should fail when originCountries is empty array', () => {
        const result = checkDataIntegrity(createMediaItem({ originCountries: [] }));

        expect(result.passes).toBe(false);
        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_ORIGIN_COUNTRY);
      });
    });

    describe('original language validation', () => {
      it('should fail when originalLanguage is null', () => {
        const result = checkDataIntegrity(createMediaItem({ originalLanguage: null }));

        expect(result.passes).toBe(false);
        expect(result.evaluation?.status).toBe(EligibilityStatus.INELIGIBLE);
        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_REQUIRED_METADATA);
        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_ORIGINAL_LANGUAGE);
      });

      it('should fail when originalLanguage is empty string', () => {
        const result = checkDataIntegrity(createMediaItem({ originalLanguage: '' }));

        expect(result.passes).toBe(false);
        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_ORIGINAL_LANGUAGE);
      });

      it('should fail when originalLanguage is whitespace only', () => {
        const result = checkDataIntegrity(createMediaItem({ originalLanguage: '   ' }));

        expect(result.passes).toBe(false);
        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_ORIGINAL_LANGUAGE);
      });
    });

    describe('title validation', () => {
      it('should fail when title is null', () => {
        const result = checkDataIntegrity(createMediaItem({ title: null }));

        expect(result.passes).toBe(false);
        expect(result.evaluation?.status).toBe(EligibilityStatus.INELIGIBLE);
        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_REQUIRED_METADATA);
        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_TITLE);
      });

      it('should fail when title is empty string', () => {
        const result = checkDataIntegrity(createMediaItem({ title: '' }));

        expect(result.passes).toBe(false);
        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_TITLE);
      });

      it('should fail when title is whitespace only', () => {
        const result = checkDataIntegrity(createMediaItem({ title: '   ' }));

        expect(result.passes).toBe(false);
        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_TITLE);
      });
    });

    describe('validation order', () => {
      it('should check origin countries first', () => {
        const result = checkDataIntegrity(
          createMediaItem({
            originCountries: null,
            originalLanguage: null,
            title: null,
          }),
        );

        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_ORIGIN_COUNTRY);
        expect(result.evaluation?.reasons).not.toContain(
          EvaluationReason.MISSING_ORIGINAL_LANGUAGE,
        );
        expect(result.evaluation?.reasons).not.toContain(EvaluationReason.MISSING_TITLE);
      });

      it('should check language second (after origin countries pass)', () => {
        const result = checkDataIntegrity(
          createMediaItem({
            originCountries: ['US'],
            originalLanguage: null,
            title: null,
          }),
        );

        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_ORIGINAL_LANGUAGE);
        expect(result.evaluation?.reasons).not.toContain(EvaluationReason.MISSING_TITLE);
      });
    });
  });
});
