import type { ShowSelectRow } from './show-select.fields';

describe('ShowSelectRow', () => {
  describe('Interface synchronization', () => {
    it('should match the expected field structure', () => {
      // ShowSelectRow keys (manually maintained to catch drift)
      const expectedKeys: (keyof ShowSelectRow)[] = [
        // Core media item fields
        'id',
        'tmdb_id',
        'title',
        'original_title',
        'slug',
        'overview',
        'poster_path',
        'backdrop_path',
        'release_date',
        'videos',
        'ingestion_status',
        // Ratings
        'rating',
        'vote_count',
        'rating_imdb',
        'vote_count_imdb',
        'rating_trakt',
        'vote_count_trakt',
        'rating_metacritic',
        'rating_rotten_tomatoes',
        'rating_rotten_tomatoes_audience',
        'popularity',
        // Stats
        'ratingo_score',
        'quality_score',
        'popularity_score',
        'watchers_count',
        'total_watchers',
        // Show-specific fields
        'last_air_date',
        'next_air_date',
        'season_number',
        'episode_number',
      ];

      // This test validates the interface structure
      // It won't compile if any expected field is missing from ShowSelectRow
      // 11 core + 10 ratings + 5 stats + 4 show-specific = 30 fields
      expect(expectedKeys).toHaveLength(30);
    });
  });

  describe('Field groupings', () => {
    it('should include all core media item fields', () => {
      const coreFields: (keyof ShowSelectRow)[] = [
        'id',
        'tmdb_id',
        'title',
        'original_title',
        'slug',
        'overview',
        'poster_path',
        'backdrop_path',
        'release_date',
        'videos',
        'ingestion_status',
      ];

      expect(coreFields).toHaveLength(11);
    });

    it('should include all external rating fields', () => {
      const ratingFields: (keyof ShowSelectRow)[] = [
        'rating',
        'vote_count',
        'rating_imdb',
        'vote_count_imdb',
        'rating_trakt',
        'vote_count_trakt',
        'rating_metacritic',
        'rating_rotten_tomatoes',
        'rating_rotten_tomatoes_audience',
        'popularity',
      ];

      expect(ratingFields).toHaveLength(10);
    });

    it('should include all stats fields', () => {
      const statsFields: (keyof ShowSelectRow)[] = [
        'ratingo_score',
        'quality_score',
        'popularity_score',
        'watchers_count',
        'total_watchers',
      ];

      expect(statsFields).toHaveLength(5);
    });

    it('should include all show-specific fields', () => {
      const showFields: (keyof ShowSelectRow)[] = [
        'last_air_date',
        'next_air_date',
        'season_number',
        'episode_number',
      ];

      expect(showFields).toHaveLength(4);
    });
  });

  describe('Type constraints', () => {
    it('should have correct nullable fields', () => {
      // This is a compile-time check - the test passes if it compiles
      const mockRow: ShowSelectRow = {
        id: 'test-id',
        tmdb_id: 12345,
        title: 'Test Show',
        original_title: null,
        slug: 'test-show',
        overview: null,
        poster_path: null,
        backdrop_path: null,
        release_date: null,
        videos: null,
        ingestion_status: 'ready',
        rating: 7.5,
        vote_count: 1000,
        rating_imdb: null,
        vote_count_imdb: null,
        rating_trakt: null,
        vote_count_trakt: null,
        rating_metacritic: null,
        rating_rotten_tomatoes: null,
        rating_rotten_tomatoes_audience: null,
        popularity: 50,
        ratingo_score: null,
        quality_score: null,
        popularity_score: null,
        watchers_count: null,
        total_watchers: null,
        last_air_date: null,
        next_air_date: null,
        season_number: null,
        episode_number: null,
      };

      expect(mockRow.id).toBe('test-id');
      expect(mockRow.original_title).toBeNull();
    });

    it('should accept valid non-null values', () => {
      const mockRow: ShowSelectRow = {
        id: 'test-id',
        tmdb_id: 12345,
        title: 'Test Show',
        original_title: 'Original Test Show',
        slug: 'test-show',
        overview: 'Test overview',
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
        release_date: new Date('2024-01-01'),
        videos: [{ key: 'trailer1' }],
        ingestion_status: 'ready',
        rating: 8.5,
        vote_count: 2000,
        rating_imdb: 8.0,
        vote_count_imdb: 1500,
        rating_trakt: 8.2,
        vote_count_trakt: 1200,
        rating_metacritic: 75,
        rating_rotten_tomatoes: 85,
        rating_rotten_tomatoes_audience: 80,
        popularity: 100,
        ratingo_score: 82,
        quality_score: 80,
        popularity_score: 85,
        watchers_count: 500,
        total_watchers: 10000,
        last_air_date: new Date('2024-06-01'),
        next_air_date: new Date('2024-06-08'),
        season_number: 3,
        episode_number: 10,
      };

      expect(mockRow.rating_imdb).toBe(8.0);
      expect(mockRow.season_number).toBe(3);
    });
  });
});
