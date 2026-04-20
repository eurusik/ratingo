import { MOVIE_DETAILS_SELECT_FIELDS } from './movie-details-select-fields';
import { type MovieDetailsQueryRow } from './movie-details.mapper';

describe('MOVIE_DETAILS_SELECT_FIELDS', () => {
  describe('Field synchronization with MovieDetailsQueryRow', () => {
    it('should have the same keys as MovieDetailsQueryRow interface', () => {
      const selectFieldKeys = Object.keys(MOVIE_DETAILS_SELECT_FIELDS).sort();

      // MovieDetailsQueryRow keys (manually maintained to catch drift)
      const expectedKeys: (keyof MovieDetailsQueryRow)[] = [
        // Core media item fields
        'id',
        'tmdbId',
        'title',
        'originalTitle',
        'slug',
        'overview',
        'posterPath',
        'ingestionStatus',
        'backdropPath',
        'rating',
        'voteCount',
        'releaseDate',
        'videos',
        'credits',
        'watchProvidersRaw',
        // External ratings
        'ratingImdb',
        'voteCountImdb',
        'ratingTrakt',
        'voteCountTrakt',
        'ratingMetacritic',
        'ratingRottenTomatoes',
        'ratingRottenTomatoesAudience',
        // Movie-specific fields
        'runtime',
        'budget',
        'revenue',
        'status',
        'theatricalReleaseDate',
        'digitalReleaseDate',
        // Stats
        'ratingoScore',
        'qualityScore',
        'popularityScore',
        'watchersCount',
        'totalWatchers',
        'communityAverageRating',
        'communityRatingCount',
      ];

      expect(selectFieldKeys).toEqual(expectedKeys.sort());
    });

    it('should have exactly 35 fields', () => {
      const fieldCount = Object.keys(MOVIE_DETAILS_SELECT_FIELDS).length;
      expect(fieldCount).toBe(35);
    });
  });

  describe('Field groupings', () => {
    it('should include all core media item fields', () => {
      const coreFields = [
        'id',
        'tmdbId',
        'title',
        'originalTitle',
        'slug',
        'overview',
        'posterPath',
        'ingestionStatus',
        'backdropPath',
        'rating',
        'voteCount',
        'releaseDate',
        'videos',
        'credits',
        'watchProvidersRaw',
      ];

      coreFields.forEach((field) => {
        expect(MOVIE_DETAILS_SELECT_FIELDS).toHaveProperty(field);
      });
    });

    it('should include all external rating fields', () => {
      const ratingFields = [
        'ratingImdb',
        'voteCountImdb',
        'ratingTrakt',
        'voteCountTrakt',
        'ratingMetacritic',
        'ratingRottenTomatoes',
        'ratingRottenTomatoesAudience',
      ];

      ratingFields.forEach((field) => {
        expect(MOVIE_DETAILS_SELECT_FIELDS).toHaveProperty(field);
      });
    });

    it('should include all movie-specific fields', () => {
      const movieFields = [
        'runtime',
        'budget',
        'revenue',
        'status',
        'theatricalReleaseDate',
        'digitalReleaseDate',
      ];

      movieFields.forEach((field) => {
        expect(MOVIE_DETAILS_SELECT_FIELDS).toHaveProperty(field);
      });
    });

    it('should include all stats fields', () => {
      const statsFields = [
        'ratingoScore',
        'qualityScore',
        'popularityScore',
        'watchersCount',
        'totalWatchers',
        'communityAverageRating',
        'communityRatingCount',
      ];

      statsFields.forEach((field) => {
        expect(MOVIE_DETAILS_SELECT_FIELDS).toHaveProperty(field);
      });
    });
  });

  describe('Drizzle column references', () => {
    it('should reference valid Drizzle columns (not undefined)', () => {
      Object.entries(MOVIE_DETAILS_SELECT_FIELDS).forEach(([key, value]) => {
        expect(value).toBeDefined();
        expect(typeof value).toBe('object');
      });
    });
  });
});
