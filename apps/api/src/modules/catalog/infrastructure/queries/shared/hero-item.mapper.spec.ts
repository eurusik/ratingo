import { MediaType } from '../../../../../common/enums/media-type.enum';
import { HERO_THRESHOLDS } from '../../../domain/constants/catalog.constants';
import { extractPrimaryTrailerKey, mapHeroResults, type HeroQueryRow } from './hero-item.mapper';

describe('hero-item.mapper', () => {
  describe('extractPrimaryTrailerKey', () => {
    it('should extract key from first video object', () => {
      const videos = [{ key: 'abc123', type: 'Trailer' }];
      expect(extractPrimaryTrailerKey(videos)).toBe('abc123');
    });

    it('should return null for empty array', () => {
      expect(extractPrimaryTrailerKey([])).toBeNull();
    });

    it('should return null for non-array', () => {
      expect(extractPrimaryTrailerKey(null)).toBeNull();
      expect(extractPrimaryTrailerKey(undefined)).toBeNull();
      expect(extractPrimaryTrailerKey('string')).toBeNull();
    });

    it('should return null if first item has no key', () => {
      const videos = [{ type: 'Trailer' }];
      expect(extractPrimaryTrailerKey(videos)).toBeNull();
    });

    it('should return null if key is not a string', () => {
      const videos = [{ key: 123 }];
      expect(extractPrimaryTrailerKey(videos)).toBeNull();
    });
  });

  describe('mapHeroResults', () => {
    const now = new Date('2025-06-15');
    const baseRow: HeroQueryRow = {
      id: 'media-1',
      type: MediaType.MOVIE,
      slug: 'test-movie',
      title: 'Test Movie',
      originalTitle: 'Original Title',
      overview: 'A test movie overview',
      posterPath: '/poster.jpg',
      backdropPath: '/backdrop.jpg',
      releaseDate: new Date('2025-05-01'),
      videos: [{ key: 'trailer123' }],
      ratingoScore: 75,
      qualityScore: 80,
      popularityScore: 70,
      watchersCount: 1000,
      totalWatchers: 50000,
      rating: 8.5,
      voteCount: 1500,
      ratingImdb: 8.0,
      voteCountImdb: 10000,
      ratingTrakt: 85,
      voteCountTrakt: 5000,
      ratingMetacritic: 75,
      ratingRottenTomatoes: 90,
    };

    it('should map movie row to HeroMediaItem', () => {
      const results = mapHeroResults([baseRow], new Map(), now);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'media-1',
        mediaItemId: 'media-1',
        type: MediaType.MOVIE,
        slug: 'test-movie',
        title: 'Test Movie',
        originalTitle: 'Original Title',
        overview: 'A test movie overview',
        primaryTrailerKey: 'trailer123',
      });
    });

    it('should set isNew=true for recent releases', () => {
      const recentRelease = new Date(now);
      recentRelease.setDate(now.getDate() - 30); // 30 days ago < 90 days threshold
      const row = { ...baseRow, releaseDate: recentRelease };

      const results = mapHeroResults([row], new Map(), now);

      expect(results[0].isNew).toBe(true);
    });

    it('should set isNew=false for old releases', () => {
      const oldRelease = new Date(now);
      oldRelease.setDate(now.getDate() - HERO_THRESHOLDS.NEW_RELEASE_DAYS - 1);
      const row = { ...baseRow, releaseDate: oldRelease };

      const results = mapHeroResults([row], new Map(), now);

      expect(results[0].isNew).toBe(false);
    });

    it('should set isClassic=true for releases older than threshold years', () => {
      const classicRelease = new Date(now);
      classicRelease.setFullYear(now.getFullYear() - HERO_THRESHOLDS.CLASSIC_YEARS - 1);
      const row = { ...baseRow, releaseDate: classicRelease };

      const results = mapHeroResults([row], new Map(), now);

      expect(results[0].isClassic).toBe(true);
    });

    it('should set isClassic=false for recent releases', () => {
      const results = mapHeroResults([baseRow], new Map(), now);

      expect(results[0].isClassic).toBe(false);
    });

    it('should handle null releaseDate', () => {
      const row = { ...baseRow, releaseDate: null };

      const results = mapHeroResults([row], new Map(), now);

      expect(results[0].isNew).toBe(false);
      expect(results[0].isClassic).toBe(false);
    });

    it('should map stats correctly', () => {
      const results = mapHeroResults([baseRow], new Map(), now);

      expect(results[0].stats).toEqual({
        ratingoScore: 75,
        qualityScore: 80,
        popularityScore: 70,
        liveWatchers: 1000,
        totalWatchers: 50000,
      });
    });

    it('should map external ratings correctly', () => {
      const results = mapHeroResults([baseRow], new Map(), now);

      expect(results[0].externalRatings).toEqual({
        tmdb: { rating: 8.5, voteCount: 1500 },
        imdb: { rating: 8.0, voteCount: 10000 },
        trakt: { rating: 85, voteCount: 5000 },
        metacritic: { rating: 75 },
        rottenTomatoes: { rating: 90 },
      });
    });

    it('should handle null external ratings', () => {
      const row = {
        ...baseRow,
        ratingImdb: null,
        voteCountImdb: null,
        ratingTrakt: null,
        ratingMetacritic: null,
        ratingRottenTomatoes: null,
      };

      const results = mapHeroResults([row], new Map(), now);

      expect(results[0].externalRatings.imdb).toBeNull();
      expect(results[0].externalRatings.trakt).toBeNull();
      expect(results[0].externalRatings.metacritic).toBeNull();
      expect(results[0].externalRatings.rottenTomatoes).toBeNull();
    });

    it('should attach showProgress for TV shows', () => {
      const showRow = { ...baseRow, id: 'show-1', type: MediaType.SHOW };
      const progressMap = new Map([
        [
          'show-1',
          {
            season: 2,
            episode: 5,
            label: 'S2E5',
            lastAirDate: new Date('2025-06-01'),
            nextAirDate: new Date('2025-06-08'),
          },
        ],
      ]);

      const results = mapHeroResults([showRow], progressMap, now);

      expect(results[0].showProgress).toEqual({
        season: 2,
        episode: 5,
        label: 'S2E5',
        lastAirDate: new Date('2025-06-01'),
        nextAirDate: new Date('2025-06-08'),
      });
    });

    it('should not attach showProgress for movies', () => {
      const progressMap = new Map([
        ['media-1', { season: 2, episode: 5, label: 'S2E5', lastAirDate: null, nextAirDate: null }],
      ]);

      const results = mapHeroResults([baseRow], progressMap, now);

      expect(results[0].showProgress).toBeUndefined();
    });
  });
});
