import type { ShowDetailsQueryRow } from './show-details.mapper';
import { SHOW_DETAILS_SELECT_FIELDS } from './show-details-select-fields';

describe('SHOW_DETAILS_SELECT_FIELDS', () => {
  describe('Field count validation', () => {
    it('should have exactly 36 fields', () => {
      const fieldCount = Object.keys(SHOW_DETAILS_SELECT_FIELDS).length;
      // 15 core + 7 external ratings + 7 show-specific + 7 stats = 36
      expect(fieldCount).toBe(36);
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

    it('should include all external rating fields (7)', () => {
      const ratingFields: (keyof typeof SHOW_DETAILS_SELECT_FIELDS)[] = [
        'ratingImdb',
        'voteCountImdb',
        'ratingTrakt',
        'voteCountTrakt',
        'ratingMetacritic',
        'ratingRottenTomatoes',
        'ratingRottenTomatoesAudience',
      ];

      expect(ratingFields).toHaveLength(7);
      for (const field of ratingFields) {
        expect(SHOW_DETAILS_SELECT_FIELDS).toHaveProperty(field);
      }
    });

    it('should include all show-specific fields (7)', () => {
      const showFields: (keyof typeof SHOW_DETAILS_SELECT_FIELDS)[] = [
        'totalSeasons',
        'totalEpisodes',
        'status',
        'lastAirDate',
        'lastSyncedAt',
        'nextAirDate',
        'showId',
      ];

      expect(showFields).toHaveLength(7);
      for (const field of showFields) {
        expect(SHOW_DETAILS_SELECT_FIELDS).toHaveProperty(field);
      }
    });

    it('should include all stats fields (7)', () => {
      const statsFields: (keyof typeof SHOW_DETAILS_SELECT_FIELDS)[] = [
        'ratingoScore',
        'qualityScore',
        'popularityScore',
        'watchersCount',
        'totalWatchers',
        'communityAverageRating',
        'communityRatingCount',
      ];

      expect(statsFields).toHaveLength(7);
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
        'ratingRottenTomatoesAudience',
        // Show-specific
        'totalSeasons',
        'totalEpisodes',
        'status',
        'lastAirDate',
        'lastSyncedAt',
        'nextAirDate',
        'showId',
        // Stats
        'ratingoScore',
        'qualityScore',
        'popularityScore',
        'watchersCount',
        'totalWatchers',
        'communityAverageRating',
        'communityRatingCount',
      ];

      expect(selectFieldKeys.sort()).toEqual(expectedKeys.sort());
    });
  });
});
