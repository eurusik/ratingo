import { MediaItemPersistenceMapper } from './media-item-persistence.mapper';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';

const createBaseMedia = (overrides = {}) => ({
  type: MediaType.MOVIE,
  externalIds: { tmdbId: 12345, imdbId: 'tt1234567' },
  title: 'Test Movie',
  originalTitle: 'Original Title',
  slug: 'test-movie',
  overview: 'A test movie overview',
  ingestionStatus: IngestionStatus.READY,
  posterPath: '/poster.jpg',
  backdropPath: '/backdrop.jpg',
  videos: [{ key: 'abc123', name: 'Trailer' }],
  credits: { cast: [], crew: [] },
  watchProvidersRaw: null,
  rating: 7.5,
  voteCount: 1000,
  popularity: 150.5,
  trendingScore: 85,
  trendingRank: 10,
  trendingUpdatedAt: new Date('2024-01-15'),
  ratingImdb: 7.8,
  voteCountImdb: 50000,
  ratingTrakt: 8.0,
  voteCountTrakt: 5000,
  ratingMetacritic: 75,
  ratingRottenTomatoes: 85,
  ratingRottenTomatoesAudience: 80,
  releaseDate: new Date('2024-03-15'),
  originCountries: ['US', 'UK'],
  originalLanguage: 'en',
  ratingoScore: 0.82,
  qualityScore: 0.75,
  popularityScore: 0.88,
  freshnessScore: 0.7,
  watchersCount: 1500,
  totalWatchers: 25000,
  genres: [],
  details: {},
  ...overrides,
});

describe('MediaItemPersistenceMapper', () => {
  describe('toMediaItemInsert', () => {
    it('should map all fields correctly', () => {
      const media = createBaseMedia();

      const result = MediaItemPersistenceMapper.toMediaItemInsert(media as any);

      expect(result).toMatchObject({
        type: MediaType.MOVIE,
        tmdbId: 12345,
        imdbId: 'tt1234567',
        title: 'Test Movie',
        originalTitle: 'Original Title',
        slug: 'test-movie',
        overview: 'A test movie overview',
        ingestionStatus: IngestionStatus.READY,
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        rating: 7.5,
        voteCount: 1000,
        popularity: 150.5,
        trendingScore: 85,
        trendingRank: 10,
        ratingImdb: 7.8,
        voteCountImdb: 50000,
        ratingTrakt: 8.0,
        voteCountTrakt: 5000,
        ratingMetacritic: 75,
        ratingRottenTomatoes: 85,
        ratingRottenTomatoesAudience: 80,
        originCountries: ['US', 'UK'],
        originalLanguage: 'en',
      });
      expect(result.releaseDate).toEqual(new Date('2024-03-15'));
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should set trendingScore to 0 when undefined', () => {
      const media = createBaseMedia({ trendingScore: undefined });

      const result = MediaItemPersistenceMapper.toMediaItemInsert(media as any);

      expect(result.trendingScore).toBe(0);
    });

    it('should generate fallback slug when empty', () => {
      const media = createBaseMedia({ slug: '' });

      const result = MediaItemPersistenceMapper.toMediaItemInsert(media as any);

      expect(result.slug).toBe('movie-12345');
    });

    it('should generate fallback slug when whitespace only', () => {
      const media = createBaseMedia({ slug: '   ' });

      const result = MediaItemPersistenceMapper.toMediaItemInsert(media as any);

      expect(result.slug).toBe('movie-12345');
    });

    it('should use originalTitle as fallback when title is missing', () => {
      const media = createBaseMedia({ title: null });

      const result = MediaItemPersistenceMapper.toMediaItemInsert(media as any);

      expect(result.title).toBe('Original Title');
    });

    it('should generate fallback title when both title and originalTitle missing', () => {
      const media = createBaseMedia({ title: null, originalTitle: null });

      const result = MediaItemPersistenceMapper.toMediaItemInsert(media as any);

      expect(result.title).toBe('Untitled 12345');
    });

    it('should handle null imdbId', () => {
      const media = createBaseMedia({
        externalIds: { tmdbId: 12345, imdbId: null },
      });

      const result = MediaItemPersistenceMapper.toMediaItemInsert(media as any);

      expect(result.imdbId).toBeNull();
    });

    it('should convert string releaseDate to Date', () => {
      const media = createBaseMedia({ releaseDate: '2024-06-20' });

      const result = MediaItemPersistenceMapper.toMediaItemInsert(media as any);

      expect(result.releaseDate).toBeInstanceOf(Date);
    });
  });

  describe('toMediaItemUpdate', () => {
    it('should include standard fields', () => {
      const media = createBaseMedia();

      const result = MediaItemPersistenceMapper.toMediaItemUpdate(media as any);

      expect(result).toMatchObject({
        imdbId: 'tt1234567',
        title: 'Test Movie',
        originalTitle: 'Original Title',
        ingestionStatus: IngestionStatus.READY,
        rating: 7.5,
        voteCount: 1000,
        popularity: 150.5,
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
      });
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should omit trendingScore when undefined', () => {
      const media = createBaseMedia({ trendingScore: undefined });

      const result = MediaItemPersistenceMapper.toMediaItemUpdate(media as any);

      expect(result).not.toHaveProperty('trendingScore');
    });

    it('should include trendingScore when defined', () => {
      const media = createBaseMedia({ trendingScore: 50 });

      const result = MediaItemPersistenceMapper.toMediaItemUpdate(media as any);

      expect(result.trendingScore).toBe(50);
      expect(result.trendingRank).toBe(10);
      expect(result.trendingUpdatedAt).toBeInstanceOf(Date);
    });

    it('should NOT include originCountries when undefined (data preservation)', () => {
      const media = createBaseMedia({ originCountries: undefined });

      const result = MediaItemPersistenceMapper.toMediaItemUpdate(media as any);

      expect(result).not.toHaveProperty('originCountries');
    });

    it('should include originCountries when explicitly null', () => {
      const media = createBaseMedia({ originCountries: null });

      const result = MediaItemPersistenceMapper.toMediaItemUpdate(media as any);

      expect(result).toHaveProperty('originCountries');
      expect(result.originCountries).toBeNull();
    });

    it('should include originCountries when array provided', () => {
      const media = createBaseMedia({ originCountries: ['JP'] });

      const result = MediaItemPersistenceMapper.toMediaItemUpdate(media as any);

      expect(result.originCountries).toEqual(['JP']);
    });

    it('should NOT include originalLanguage when undefined', () => {
      const media = createBaseMedia({ originalLanguage: undefined });

      const result = MediaItemPersistenceMapper.toMediaItemUpdate(media as any);

      expect(result).not.toHaveProperty('originalLanguage');
    });

    it('should include originalLanguage when provided', () => {
      const media = createBaseMedia({ originalLanguage: 'ja' });

      const result = MediaItemPersistenceMapper.toMediaItemUpdate(media as any);

      expect(result.originalLanguage).toBe('ja');
    });

    it('should NOT include overview when undefined', () => {
      const media = createBaseMedia({ overview: undefined });

      const result = MediaItemPersistenceMapper.toMediaItemUpdate(media as any);

      expect(result).not.toHaveProperty('overview');
    });

    it('should include overview when empty string (explicit clear)', () => {
      const media = createBaseMedia({ overview: '' });

      const result = MediaItemPersistenceMapper.toMediaItemUpdate(media as any);

      expect(result).toHaveProperty('overview');
      expect(result.overview).toBe('');
    });

    it('should preserve existing data when sync payload is incomplete', () => {
      // Simulates fallback path where some fields are missing
      const incompletePayload = {
        externalIds: { tmdbId: 123, imdbId: null },
        title: 'Some Movie',
        rating: 7.5,
        voteCount: 100,
        popularity: 50,
        // originCountries: undefined (not provided)
        // originalLanguage: undefined (not provided)
        // overview: undefined (not provided)
      };

      const result = MediaItemPersistenceMapper.toMediaItemUpdate(incompletePayload as any);

      expect(result).not.toHaveProperty('originCountries');
      expect(result).not.toHaveProperty('originalLanguage');
      expect(result).not.toHaveProperty('overview');
      expect(result.title).toBe('Some Movie');
      expect(result.rating).toBe(7.5);
    });

    it('should always include updatedAt', () => {
      const media = createBaseMedia();

      const result = MediaItemPersistenceMapper.toMediaItemUpdate(media as any);

      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should NOT overwrite external ratings with null (preserve values filled by other sources)', () => {
      const media = createBaseMedia({
        ratingImdb: null,
        voteCountImdb: null,
        ratingTrakt: null,
        voteCountTrakt: null,
        ratingMetacritic: null,
        ratingRottenTomatoes: null,
        ratingRottenTomatoesAudience: null,
      });

      const result = MediaItemPersistenceMapper.toMediaItemUpdate(media as any);

      expect(result).not.toHaveProperty('ratingImdb');
      expect(result).not.toHaveProperty('voteCountImdb');
      expect(result).not.toHaveProperty('ratingTrakt');
      expect(result).not.toHaveProperty('voteCountTrakt');
      expect(result).not.toHaveProperty('ratingMetacritic');
      expect(result).not.toHaveProperty('ratingRottenTomatoes');
      expect(result).not.toHaveProperty('ratingRottenTomatoesAudience');
    });

    it('should include external ratings when non-null values provided', () => {
      const media = createBaseMedia({
        ratingImdb: 8.2,
        ratingRottenTomatoes: 78,
        ratingRottenTomatoesAudience: 76,
        ratingMetacritic: 70,
      });

      const result = MediaItemPersistenceMapper.toMediaItemUpdate(media as any);

      expect(result.ratingImdb).toBe(8.2);
      expect(result.ratingRottenTomatoes).toBe(78);
      expect(result.ratingRottenTomatoesAudience).toBe(76);
      expect(result.ratingMetacritic).toBe(70);
    });
  });

  describe('toMediaStatsInsert', () => {
    it('should return null when ratingoScore is undefined', () => {
      const media = createBaseMedia({ ratingoScore: undefined });

      const result = MediaItemPersistenceMapper.toMediaStatsInsert('media-1', media as any);

      expect(result).toBeNull();
    });

    it('should map all score fields correctly', () => {
      const media = createBaseMedia();

      const result = MediaItemPersistenceMapper.toMediaStatsInsert('media-1', media as any);

      expect(result).toMatchObject({
        mediaItemId: 'media-1',
        ratingoScore: 0.82,
        qualityScore: 0.75,
        popularityScore: 0.88,
        freshnessScore: 0.7,
        watchersCount: 1500,
        totalWatchers: 25000,
      });
      expect(result!.updatedAt).toBeInstanceOf(Date);
    });

    it('should NOT include watchersCount when null', () => {
      const media = createBaseMedia({ watchersCount: null });

      const result = MediaItemPersistenceMapper.toMediaStatsInsert('media-1', media as any);

      expect(result).not.toHaveProperty('watchersCount');
    });

    it('should NOT include watchersCount when undefined', () => {
      const media = createBaseMedia({ watchersCount: undefined });

      const result = MediaItemPersistenceMapper.toMediaStatsInsert('media-1', media as any);

      expect(result).not.toHaveProperty('watchersCount');
    });

    it('should include watchersCount when 0', () => {
      const media = createBaseMedia({ watchersCount: 0 });

      const result = MediaItemPersistenceMapper.toMediaStatsInsert('media-1', media as any);

      expect(result!.watchersCount).toBe(0);
    });

    it('should NOT include totalWatchers when null', () => {
      const media = createBaseMedia({ totalWatchers: null });

      const result = MediaItemPersistenceMapper.toMediaStatsInsert('media-1', media as any);

      expect(result).not.toHaveProperty('totalWatchers');
    });

    it('should NOT include totalWatchers when undefined', () => {
      const media = createBaseMedia({ totalWatchers: undefined });

      const result = MediaItemPersistenceMapper.toMediaStatsInsert('media-1', media as any);

      expect(result).not.toHaveProperty('totalWatchers');
    });

    it('should include totalWatchers when 0', () => {
      const media = createBaseMedia({ totalWatchers: 0 });

      const result = MediaItemPersistenceMapper.toMediaStatsInsert('media-1', media as any);

      expect(result!.totalWatchers).toBe(0);
    });
  });
});
