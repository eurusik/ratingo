import { HERO_SELECT_FIELDS } from './hero-select-fields';
import { type HeroQueryRow } from './hero-item.mapper';

describe('HERO_SELECT_FIELDS', () => {
  describe('Field synchronization with HeroQueryRow', () => {
    it('should have the same keys as HeroQueryRow interface', () => {
      const selectFieldKeys = Object.keys(HERO_SELECT_FIELDS).sort();

      // HeroQueryRow keys (manually maintained to catch drift)
      const expectedKeys: (keyof HeroQueryRow)[] = [
        'id',
        'type',
        'slug',
        'title',
        'originalTitle',
        'overview',
        'posterPath',
        'backdropPath',
        'releaseDate',
        'videos',
        'ratingoScore',
        'qualityScore',
        'popularityScore',
        'watchersCount',
        'totalWatchers',
        'rating',
        'voteCount',
        'ratingImdb',
        'voteCountImdb',
        'ratingTrakt',
        'voteCountTrakt',
        'ratingMetacritic',
        'ratingRottenTomatoes',
        'ratingRottenTomatoesAudience',
      ];

      expect(selectFieldKeys).toEqual(expectedKeys.sort());
    });

    it('should have exactly 24 fields', () => {
      const fieldCount = Object.keys(HERO_SELECT_FIELDS).length;
      expect(fieldCount).toBe(24);
    });
  });

  describe('Field groupings', () => {
    it('should include all core media item fields', () => {
      const coreFields = [
        'id',
        'type',
        'slug',
        'title',
        'originalTitle',
        'overview',
        'posterPath',
        'backdropPath',
        'releaseDate',
        'videos',
      ];

      coreFields.forEach((field) => {
        expect(HERO_SELECT_FIELDS).toHaveProperty(field);
      });
    });

    it('should include all stats fields', () => {
      const statsFields = [
        'ratingoScore',
        'qualityScore',
        'popularityScore',
        'watchersCount',
        'totalWatchers',
      ];

      statsFields.forEach((field) => {
        expect(HERO_SELECT_FIELDS).toHaveProperty(field);
      });
    });

    it('should include all external rating fields', () => {
      const ratingFields = [
        'rating',
        'voteCount',
        'ratingImdb',
        'voteCountImdb',
        'ratingTrakt',
        'voteCountTrakt',
        'ratingMetacritic',
        'ratingRottenTomatoes',
        'ratingRottenTomatoesAudience',
      ];

      ratingFields.forEach((field) => {
        expect(HERO_SELECT_FIELDS).toHaveProperty(field);
      });
    });
  });

  describe('Drizzle column references', () => {
    it('should reference valid Drizzle columns (not undefined)', () => {
      Object.entries(HERO_SELECT_FIELDS).forEach(([key, value]) => {
        expect(value).toBeDefined();
        expect(typeof value).toBe('object');
      });
    });
  });
});
