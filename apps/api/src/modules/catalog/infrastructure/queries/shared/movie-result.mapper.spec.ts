import { MovieResultMapper } from './movie-result.mapper';
import type { MovieSelectRow } from './movie-select.fields';
import type { GenreInfo } from '../../../domain/types/common.types';

describe('MovieResultMapper', () => {
  const baseRow: MovieSelectRow = {
    id: 'movie-1',
    mediaItemId: 'media-1',
    tmdbId: 12345,
    title: 'Test Movie',
    slug: 'test-movie',
    overview: 'A test movie overview',
    ingestionStatus: 'ready',
    posterPath: '/poster.jpg',
    backdropPath: '/backdrop.jpg',
    popularity: 100,
    rating: 8.5,
    voteCount: 1500,
    releaseDate: new Date('2024-06-01'),
    ratingImdb: 8.0,
    voteCountImdb: 10000,
    ratingTrakt: 85,
    voteCountTrakt: 5000,
    ratingMetacritic: 75,
    ratingRottenTomatoes: 90,
    theatricalReleaseDate: new Date('2024-05-15'),
    digitalReleaseDate: new Date('2024-08-01'),
    runtime: 120,
    ratingoScore: 75,
    qualityScore: 80,
    popularityScore: 70,
    watchersCount: 1000,
    totalWatchers: 50000,
  };

  const genres: GenreInfo[] = [
    { id: 'g1', name: 'Action', slug: 'action' },
    { id: 'g2', name: 'Comedy', slug: 'comedy' },
  ];

  describe('toMovieWithMedia', () => {
    it('should map row to MovieWithMedia DTO', () => {
      const result = MovieResultMapper.toMovieWithMedia(baseRow, genres);

      expect(result).toMatchObject({
        id: 'movie-1',
        mediaItemId: 'media-1',
        tmdbId: 12345,
        title: 'Test Movie',
        slug: 'test-movie',
        overview: 'A test movie overview',
        ingestionStatus: 'ready',
        popularity: 100,
        releaseDate: new Date('2024-06-01'),
        theatricalReleaseDate: new Date('2024-05-15'),
        digitalReleaseDate: new Date('2024-08-01'),
        runtime: 120,
        genres,
      });
    });

    it('should map stats correctly', () => {
      const result = MovieResultMapper.toMovieWithMedia(baseRow, genres);

      expect(result.stats).toEqual({
        ratingoScore: 75,
        qualityScore: 80,
        popularityScore: 70,
        liveWatchers: 1000,
        totalWatchers: 50000,
        communityAverageRating: null,
        communityRatingCount: null,
      });
    });

    it('should map external ratings with all sources', () => {
      const result = MovieResultMapper.toMovieWithMedia(baseRow, genres);

      expect(result.externalRatings).toEqual({
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

      const result = MovieResultMapper.toMovieWithMedia(row, genres);

      expect(result.externalRatings.imdb).toBeNull();
      expect(result.externalRatings.trakt).toBeNull();
      expect(result.externalRatings.metacritic).toBeNull();
      expect(result.externalRatings.rottenTomatoes).toBeNull();
    });

    it('should map images using ImageMapper', () => {
      const result = MovieResultMapper.toMovieWithMedia(baseRow, genres);

      expect(result.poster).toBeDefined();
      expect(result.backdrop).toBeDefined();
    });

    it('should set videos to null', () => {
      const result = MovieResultMapper.toMovieWithMedia(baseRow, genres);

      expect(result.videos).toBeNull();
    });
  });

  describe('toTrendingItem', () => {
    it('should include isNew and isClassic flags', () => {
      const result = MovieResultMapper.toTrendingItem(baseRow, genres);

      expect(result).toHaveProperty('isNew');
      expect(result).toHaveProperty('isClassic');
    });

    it('should set isNew=true for recent release', () => {
      const recentRelease = new Date();
      recentRelease.setDate(recentRelease.getDate() - 30); // 30 days ago
      const row = { ...baseRow, releaseDate: recentRelease };

      const result = MovieResultMapper.toTrendingItem(row, genres);

      expect(result.isNew).toBe(true);
    });

    it('should set isClassic=true for high quality old content', () => {
      const oldRelease = new Date();
      oldRelease.setFullYear(oldRelease.getFullYear() - 15);
      const row = { ...baseRow, releaseDate: oldRelease };

      const result = MovieResultMapper.toTrendingItem(row, genres);

      expect(result.isClassic).toBe(true);
    });

    it('should inherit all MovieWithMedia fields', () => {
      const result = MovieResultMapper.toTrendingItem(baseRow, genres);

      expect(result.id).toBe('movie-1');
      expect(result.title).toBe('Test Movie');
      expect(result.genres).toEqual(genres);
    });
  });

  describe('mapMany', () => {
    it('should map multiple rows with genres map', () => {
      const rows = [
        baseRow,
        { ...baseRow, id: 'movie-2', mediaItemId: 'media-2', title: 'Movie 2' },
      ];
      const genresMap = new Map([
        ['media-1', genres],
        ['media-2', [{ id: 'g3', name: 'Drama', slug: 'drama' }]],
      ]);

      const result = MovieResultMapper.mapMany(rows, genresMap);

      expect(result).toHaveLength(2);
      expect(result[0].genres).toEqual(genres);
      expect(result[1].genres).toEqual([{ id: 'g3', name: 'Drama', slug: 'drama' }]);
    });

    it('should use empty array for missing genres', () => {
      const genresMap = new Map<string, GenreInfo[]>();

      const result = MovieResultMapper.mapMany([baseRow], genresMap);

      expect(result[0].genres).toEqual([]);
    });
  });

  describe('mapManyTrending', () => {
    it('should map multiple rows to TrendingMovieItem array', () => {
      const rows = [baseRow, { ...baseRow, id: 'movie-2', mediaItemId: 'media-2' }];
      const genresMap = new Map([
        ['media-1', genres],
        ['media-2', []],
      ]);

      const result = MovieResultMapper.mapManyTrending(rows, genresMap);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('isNew');
      expect(result[0]).toHaveProperty('isClassic');
      expect(result[1]).toHaveProperty('isNew');
      expect(result[1]).toHaveProperty('isClassic');
    });
  });
});
