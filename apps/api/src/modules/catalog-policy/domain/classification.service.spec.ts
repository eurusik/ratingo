import {
  classifyContent,
  ClassificationInput,
  ContentClass,
  ContentClassValues,
  isValidContentClass,
  VALID_CONTENT_CLASSES,
} from './classification.service';
import { TMDB_GENRE_IDS } from './constants/genre-mapping.constants';

describe('Classification Service', () => {
  describe('classifyContent', () => {
    describe('Anime classification', () => {
      it('should classify Animation + JP origin as anime', () => {
        const input: ClassificationInput = {
          originCountries: ['JP'],
          originalLanguage: 'en',
          genreIds: [TMDB_GENRE_IDS.ANIMATION],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.ANIME);
      });

      it('should classify Animation + ja language as anime', () => {
        const input: ClassificationInput = {
          originCountries: ['US'],
          originalLanguage: 'ja',
          genreIds: [TMDB_GENRE_IDS.ANIMATION],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.ANIME);
      });

      it('should classify Animation + JP origin + ja language as anime', () => {
        const input: ClassificationInput = {
          originCountries: ['JP'],
          originalLanguage: 'ja',
          genreIds: [TMDB_GENRE_IDS.ANIMATION],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.ANIME);
      });

      it('should classify Animation + JP in multi-country as anime', () => {
        const input: ClassificationInput = {
          originCountries: ['US', 'JP'],
          originalLanguage: 'en',
          genreIds: [TMDB_GENRE_IDS.ANIMATION],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.ANIME);
      });

      it('should NOT classify Animation + US origin as anime (western animation)', () => {
        const input: ClassificationInput = {
          originCountries: ['US'],
          originalLanguage: 'en',
          genreIds: [TMDB_GENRE_IDS.ANIMATION],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.MAINSTREAM);
      });

      it('should NOT classify Animation + FR origin as anime', () => {
        const input: ClassificationInput = {
          originCountries: ['FR'],
          originalLanguage: 'fr',
          genreIds: [TMDB_GENRE_IDS.ANIMATION],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.MAINSTREAM);
      });
    });

    describe('Documentary classification', () => {
      it('should classify Documentary genre as documentary', () => {
        const input: ClassificationInput = {
          originCountries: ['US'],
          originalLanguage: 'en',
          genreIds: [TMDB_GENRE_IDS.DOCUMENTARY],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.DOCUMENTARY);
      });

      it('should classify Documentary regardless of origin', () => {
        const input: ClassificationInput = {
          originCountries: ['JP'],
          originalLanguage: 'ja',
          genreIds: [TMDB_GENRE_IDS.DOCUMENTARY],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.DOCUMENTARY);
      });
    });

    describe('Reality classification', () => {
      it('should classify Reality genre as reality', () => {
        const input: ClassificationInput = {
          originCountries: ['US'],
          originalLanguage: 'en',
          genreIds: [TMDB_GENRE_IDS.REALITY],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.REALITY);
      });
    });

    describe('Kids classification', () => {
      it('should classify Kids genre (10762) as kids', () => {
        const input: ClassificationInput = {
          originCountries: ['US'],
          originalLanguage: 'en',
          genreIds: [TMDB_GENRE_IDS.KIDS],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.KIDS);
      });

      it('should NOT classify Family genre (10751) as kids', () => {
        const input: ClassificationInput = {
          originCountries: ['US'],
          originalLanguage: 'en',
          genreIds: [TMDB_GENRE_IDS.FAMILY],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.MAINSTREAM);
      });

      it('should NOT classify Family + Animation as kids', () => {
        const input: ClassificationInput = {
          originCountries: ['US'],
          originalLanguage: 'en',
          genreIds: [TMDB_GENRE_IDS.FAMILY, TMDB_GENRE_IDS.ANIMATION],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.MAINSTREAM);
      });
    });

    describe('Mainstream (default) classification', () => {
      it('should classify content without special genres as mainstream', () => {
        const input: ClassificationInput = {
          originCountries: ['US'],
          originalLanguage: 'en',
          genreIds: [28, 12], // Action, Adventure
        };

        expect(classifyContent(input)).toBe(ContentClassValues.MAINSTREAM);
      });

      it('should classify empty genres as mainstream', () => {
        const input: ClassificationInput = {
          originCountries: ['US'],
          originalLanguage: 'en',
          genreIds: [],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.MAINSTREAM);
      });
    });

    describe('Edge cases and graceful fallbacks', () => {
      it('should handle null originCountries gracefully', () => {
        const input: ClassificationInput = {
          originCountries: null,
          originalLanguage: 'en',
          genreIds: [TMDB_GENRE_IDS.ANIMATION],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.MAINSTREAM);
      });

      it('should handle null originalLanguage gracefully', () => {
        const input: ClassificationInput = {
          originCountries: ['JP'],
          originalLanguage: null,
          genreIds: [TMDB_GENRE_IDS.ANIMATION],
        };

        // JP origin is enough for anime classification
        expect(classifyContent(input)).toBe(ContentClassValues.ANIME);
      });

      it('should handle both null origin data gracefully', () => {
        const input: ClassificationInput = {
          originCountries: null,
          originalLanguage: null,
          genreIds: [TMDB_GENRE_IDS.ANIMATION],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.MAINSTREAM);
      });

      it('should handle empty originCountries array', () => {
        const input: ClassificationInput = {
          originCountries: [],
          originalLanguage: 'ja',
          genreIds: [TMDB_GENRE_IDS.ANIMATION],
        };

        // ja language is enough for anime classification
        expect(classifyContent(input)).toBe(ContentClassValues.ANIME);
      });

      it('should handle undefined genreIds as empty array', () => {
        const input = {
          originCountries: ['US'],
          originalLanguage: 'en',
          genreIds: undefined as unknown as number[],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.MAINSTREAM);
      });

      it('should handle null genreIds as empty array', () => {
        const input = {
          originCountries: ['US'],
          originalLanguage: 'en',
          genreIds: null as unknown as number[],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.MAINSTREAM);
      });
    });

    describe('Priority order', () => {
      it('should prioritize anime over documentary (Animation + Documentary + JP)', () => {
        const input: ClassificationInput = {
          originCountries: ['JP'],
          originalLanguage: 'ja',
          genreIds: [TMDB_GENRE_IDS.ANIMATION, TMDB_GENRE_IDS.DOCUMENTARY],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.ANIME);
      });

      it('should prioritize documentary over reality', () => {
        const input: ClassificationInput = {
          originCountries: ['US'],
          originalLanguage: 'en',
          genreIds: [TMDB_GENRE_IDS.DOCUMENTARY, TMDB_GENRE_IDS.REALITY],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.DOCUMENTARY);
      });

      it('should prioritize reality over kids', () => {
        const input: ClassificationInput = {
          originCountries: ['US'],
          originalLanguage: 'en',
          genreIds: [TMDB_GENRE_IDS.REALITY, TMDB_GENRE_IDS.KIDS],
        };

        expect(classifyContent(input)).toBe(ContentClassValues.REALITY);
      });
    });

    describe('Determinism', () => {
      it('should produce same result for same input (deterministic)', () => {
        const input: ClassificationInput = {
          originCountries: ['JP'],
          originalLanguage: 'ja',
          genreIds: [TMDB_GENRE_IDS.ANIMATION, 28, 12],
        };

        const result1 = classifyContent(input);
        const result2 = classifyContent(input);
        const result3 = classifyContent(input);

        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
        expect(result1).toBe(ContentClassValues.ANIME);
      });
    });
  });

  describe('isValidContentClass', () => {
    it('should return true for valid content classes', () => {
      expect(isValidContentClass(ContentClassValues.MAINSTREAM)).toBe(true);
      expect(isValidContentClass(ContentClassValues.ANIME)).toBe(true);
      expect(isValidContentClass(ContentClassValues.DOCUMENTARY)).toBe(true);
      expect(isValidContentClass(ContentClassValues.REALITY)).toBe(true);
      expect(isValidContentClass(ContentClassValues.KIDS)).toBe(true);
    });

    it('should return false for invalid content classes', () => {
      expect(isValidContentClass('invalid')).toBe(false);
      expect(isValidContentClass('')).toBe(false);
      expect(isValidContentClass(null)).toBe(false);
      expect(isValidContentClass(undefined)).toBe(false);
      expect(isValidContentClass(123)).toBe(false);
      expect(isValidContentClass({})).toBe(false);
    });
  });

  describe('VALID_CONTENT_CLASSES', () => {
    it('should contain all expected content classes', () => {
      expect(VALID_CONTENT_CLASSES).toContain(ContentClassValues.MAINSTREAM);
      expect(VALID_CONTENT_CLASSES).toContain(ContentClassValues.ANIME);
      expect(VALID_CONTENT_CLASSES).toContain(ContentClassValues.DOCUMENTARY);
      expect(VALID_CONTENT_CLASSES).toContain(ContentClassValues.REALITY);
      expect(VALID_CONTENT_CLASSES).toContain(ContentClassValues.KIDS);
      expect(VALID_CONTENT_CLASSES).toHaveLength(5);
    });
  });

  describe('TMDB_GENRE_IDS constants', () => {
    it('should have correct TMDB genre IDs', () => {
      expect(TMDB_GENRE_IDS.ANIMATION).toBe(16);
      expect(TMDB_GENRE_IDS.DOCUMENTARY).toBe(99);
      expect(TMDB_GENRE_IDS.REALITY).toBe(10764);
      expect(TMDB_GENRE_IDS.KIDS).toBe(10762);
      expect(TMDB_GENRE_IDS.FAMILY).toBe(10751);
    });
  });
});
