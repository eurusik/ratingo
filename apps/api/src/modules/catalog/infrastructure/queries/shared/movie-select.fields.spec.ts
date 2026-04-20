import { movieSelectFields, type MovieSelectRow } from './movie-select.fields';
import * as schema from '../../../../../database/schema';

describe('movie-select.fields', () => {
  describe('movieSelectFields - schema mappings', () => {
    it('should map id to movies.id column', () => {
      expect(movieSelectFields.id).toBe(schema.movies.id);
    });

    it('should map mediaItemId to movies.mediaItemId column', () => {
      expect(movieSelectFields.mediaItemId).toBe(schema.movies.mediaItemId);
    });

    it('should map tmdbId to mediaItems.tmdbId column', () => {
      expect(movieSelectFields.tmdbId).toBe(schema.mediaItems.tmdbId);
    });

    it('should map title to mediaItems.title column', () => {
      expect(movieSelectFields.title).toBe(schema.mediaItems.title);
    });

    it('should map slug to mediaItems.slug column', () => {
      expect(movieSelectFields.slug).toBe(schema.mediaItems.slug);
    });

    it('should map movie-specific fields to movies table', () => {
      expect(movieSelectFields.theatricalReleaseDate).toBe(schema.movies.theatricalReleaseDate);
      expect(movieSelectFields.digitalReleaseDate).toBe(schema.movies.digitalReleaseDate);
      expect(movieSelectFields.runtime).toBe(schema.movies.runtime);
    });

    it('should map stats fields to mediaStats table', () => {
      expect(movieSelectFields.ratingoScore).toBe(schema.mediaStats.ratingoScore);
      expect(movieSelectFields.qualityScore).toBe(schema.mediaStats.qualityScore);
      expect(movieSelectFields.popularityScore).toBe(schema.mediaStats.popularityScore);
      expect(movieSelectFields.watchersCount).toBe(schema.mediaStats.watchersCount);
      expect(movieSelectFields.totalWatchers).toBe(schema.mediaStats.totalWatchers);
    });

    it('should map external ratings to mediaItems table', () => {
      expect(movieSelectFields.ratingImdb).toBe(schema.mediaItems.ratingImdb);
      expect(movieSelectFields.voteCountImdb).toBe(schema.mediaItems.voteCountImdb);
      expect(movieSelectFields.ratingTrakt).toBe(schema.mediaItems.ratingTrakt);
      expect(movieSelectFields.voteCountTrakt).toBe(schema.mediaItems.voteCountTrakt);
      expect(movieSelectFields.ratingMetacritic).toBe(schema.mediaItems.ratingMetacritic);
      expect(movieSelectFields.ratingRottenTomatoes).toBe(schema.mediaItems.ratingRottenTomatoes);
      expect(movieSelectFields.ratingRottenTomatoesAudience).toBe(
        schema.mediaItems.ratingRottenTomatoesAudience,
      );
    });

    it('should map common media fields to mediaItems table', () => {
      expect(movieSelectFields.overview).toBe(schema.mediaItems.overview);
      expect(movieSelectFields.ingestionStatus).toBe(schema.mediaItems.ingestionStatus);
      expect(movieSelectFields.posterPath).toBe(schema.mediaItems.posterPath);
      expect(movieSelectFields.backdropPath).toBe(schema.mediaItems.backdropPath);
      expect(movieSelectFields.popularity).toBe(schema.mediaItems.popularity);
      expect(movieSelectFields.rating).toBe(schema.mediaItems.rating);
      expect(movieSelectFields.voteCount).toBe(schema.mediaItems.voteCount);
      expect(movieSelectFields.releaseDate).toBe(schema.mediaItems.releaseDate);
    });
  });

  describe('movieSelectFields - completeness', () => {
    it('should have exactly 28 fields', () => {
      // Ensures no fields are accidentally added or removed
      expect(Object.keys(movieSelectFields)).toHaveLength(28);
    });

    it('should define all required fields', () => {
      const requiredFields = [
        'id',
        'mediaItemId',
        'tmdbId',
        'title',
        'slug',
        'overview',
        'ingestionStatus',
        'posterPath',
        'backdropPath',
        'popularity',
        'rating',
        'voteCount',
        'releaseDate',
        'ratingImdb',
        'voteCountImdb',
        'ratingTrakt',
        'voteCountTrakt',
        'ratingMetacritic',
        'ratingRottenTomatoes',
        'ratingRottenTomatoesAudience',
        'theatricalReleaseDate',
        'digitalReleaseDate',
        'runtime',
        'ratingoScore',
        'qualityScore',
        'popularityScore',
        'watchersCount',
        'totalWatchers',
      ];

      requiredFields.forEach((field) => {
        expect(movieSelectFields).toHaveProperty(field);
      });
    });
  });

  describe('MovieSelectRow type', () => {
    it('should be assignable with valid data', () => {
      const row: MovieSelectRow = {
        id: 'movie-1',
        mediaItemId: 'media-1',
        tmdbId: 12345,
        title: 'Test Movie',
        slug: 'test-movie',
        overview: 'Overview text',
        ingestionStatus: 'ready',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        popularity: 100,
        rating: 8.5,
        voteCount: 1500,
        releaseDate: new Date(),
        ratingImdb: 8.0,
        voteCountImdb: 10000,
        ratingTrakt: 85,
        voteCountTrakt: 5000,
        ratingMetacritic: 75,
        ratingRottenTomatoes: 90,
        ratingRottenTomatoesAudience: 85,
        theatricalReleaseDate: new Date(),
        digitalReleaseDate: new Date(),
        runtime: 120,
        ratingoScore: 75,
        qualityScore: 80,
        popularityScore: 70,
        watchersCount: 1000,
        totalWatchers: 50000,
      };

      expect(row.id).toBe('movie-1');
      expect(row.tmdbId).toBe(12345);
    });

    it('should accept null for nullable fields', () => {
      const row: MovieSelectRow = {
        id: 'movie-1',
        mediaItemId: 'media-1',
        tmdbId: 12345,
        title: 'Test Movie',
        slug: 'test-movie',
        overview: null,
        ingestionStatus: 'ready',
        posterPath: null,
        backdropPath: null,
        popularity: 100,
        rating: 8.5,
        voteCount: 1500,
        releaseDate: null,
        ratingImdb: null,
        voteCountImdb: null,
        ratingTrakt: null,
        voteCountTrakt: null,
        ratingMetacritic: null,
        ratingRottenTomatoes: null,
        ratingRottenTomatoesAudience: null,
        theatricalReleaseDate: null,
        digitalReleaseDate: null,
        runtime: null,
        ratingoScore: null,
        qualityScore: null,
        popularityScore: null,
        watchersCount: null,
        totalWatchers: null,
      };

      expect(row.overview).toBeNull();
      expect(row.releaseDate).toBeNull();
    });
  });
});
