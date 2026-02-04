import type { ShowDetailsQueryRow } from './show-details.mapper';
import { SHOW_DETAILS_SELECT_FIELDS } from './show-details-select-fields';

describe('SHOW_DETAILS_SELECT_FIELDS', () => {
  describe('Field count validation', () => {
    it('should have exactly 32 fields', () => {
      const fieldCount = Object.keys(SHOW_DETAILS_SELECT_FIELDS).length;
      // 15 core + 6 external ratings + 6 show-specific + 5 stats = 32
      expect(fieldCount).toBe(32);
    });
  });

  describe('Field groupings', () => {
    it('should include all core media item fields (15)', () => {
      const coreFields: (keyof typeof SHOW_DETAILS_SELECT_FIELDS)[] = [
        'id',
        'tmdbId',
        'title',
        'originalTitle',
        'slug',
        'overview',
        'posterPath',
        'ingestionStatus',
        'backdropPath',
        'videos',
        'credits',
        'watchProvidersRaw',
        'rating',
        'voteCount',
        'releaseDate',
      ];

      expect(coreFields).toHaveLength(15);
      for (const field of coreFields) {
        expect(SHOW_DETAILS_SELECT_FIELDS).toHaveProperty(field);
      }
    });

    it('should include all external rating fields (6)', () => {
      const ratingFields: (keyof typeof SHOW_DETAILS_SELECT_FIELDS)[] = [
        'ratingImdb',
        'voteCountImdb',
        'ratingTrakt',
        'voteCountTrakt',
        'ratingMetacritic',
        'ratingRottenTomatoes',
      ];

      expect(ratingFields).toHaveLength(6);
      for (const field of ratingFields) {
        expect(SHOW_DETAILS_SELECT_FIELDS).toHaveProperty(field);
      }
    });

    it('should include all show-specific fields (6)', () => {
      const showFields: (keyof typeof SHOW_DETAILS_SELECT_FIELDS)[] = [
        'totalSeasons',
        'totalEpisodes',
        'status',
        'lastAirDate',
        'nextAirDate',
        'showId',
      ];

      expect(showFields).toHaveLength(6);
      for (const field of showFields) {
        expect(SHOW_DETAILS_SELECT_FIELDS).toHaveProperty(field);
      }
    });

    it('should include all stats fields (5)', () => {
      const statsFields: (keyof typeof SHOW_DETAILS_SELECT_FIELDS)[] = [
        'ratingoScore',
        'qualityScore',
        'popularityScore',
        'watchersCount',
        'totalWatchers',
      ];

      expect(statsFields).toHaveLength(5);
      for (const field of statsFields) {
        expect(SHOW_DETAILS_SELECT_FIELDS).toHaveProperty(field);
      }
    });
  });

  describe('Interface synchronization', () => {
    it('should have keys matching ShowDetailsQueryRow interface', () => {
      // This is a compile-time check - the test passes if it compiles
      const selectFieldKeys = Object.keys(
        SHOW_DETAILS_SELECT_FIELDS,
      ) as (keyof typeof SHOW_DETAILS_SELECT_FIELDS)[];

      // ShowDetailsQueryRow keys (manually maintained to catch drift)
      const expectedKeys: (keyof ShowDetailsQueryRow)[] = [
        // Core
        'id',
        'tmdbId',
        'title',
        'originalTitle',
        'slug',
        'overview',
        'posterPath',
        'ingestionStatus',
        'backdropPath',
        'videos',
        'credits',
        'watchProvidersRaw',
        'rating',
        'voteCount',
        'releaseDate',
        // External ratings
        'ratingImdb',
        'voteCountImdb',
        'ratingTrakt',
        'voteCountTrakt',
        'ratingMetacritic',
        'ratingRottenTomatoes',
        // Show-specific
        'totalSeasons',
        'totalEpisodes',
        'status',
        'lastAirDate',
        'nextAirDate',
        'showId',
        // Stats
        'ratingoScore',
        'qualityScore',
        'popularityScore',
        'watchersCount',
        'totalWatchers',
      ];

      expect(selectFieldKeys.sort()).toEqual(expectedKeys.sort());
    });
  });
});
