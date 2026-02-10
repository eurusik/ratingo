import { ImageMapper } from '../../../../../common/mappers/image.mapper';
import { CreditsMapper } from '../../mappers/credits.mapper';
import {
  MediaWatchOffersMapper,
  type WatchOfferRow,
} from '../../mappers/media-watch-offers.mapper';

import {
  type MovieDetailsQueryRow,
  mapMovieDetails,
  mapExternalRatings,
  mapRatingoStats,
} from './movie-details.mapper';

describe('movie-details.mapper', () => {
  beforeEach(() => {
    jest.spyOn(ImageMapper, 'toPoster').mockReturnValue({ small: 'poster' } as any);
    jest.spyOn(ImageMapper, 'toBackdrop').mockReturnValue({ small: 'backdrop' } as any);
    jest.spyOn(CreditsMapper, 'toDto').mockReturnValue({ cast: [], crew: [] });
    jest.spyOn(MediaWatchOffersMapper, 'toAvailability').mockReturnValue({
      region: 'UA',
      isFallback: false,
      link: null,
      hint: 'svod',
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockRow = (overrides: Partial<MovieDetailsQueryRow> = {}): MovieDetailsQueryRow => ({
    id: 'm1',
    tmdbId: 101,
    title: 'Test Movie',
    originalTitle: 'Original Title',
    slug: 'test-movie',
    overview: 'Test overview',
    posterPath: '/poster.jpg',
    ingestionStatus: 'ready',
    backdropPath: '/backdrop.jpg',
    rating: 8.0,
    voteCount: 1000,
    releaseDate: new Date('2024-01-01'),
    videos: [{ key: 'trailer1' }],
    credits: {},
    watchProvidersRaw: {},
    ratingImdb: 7.5,
    voteCountImdb: 900,
    ratingTrakt: 8.2,
    voteCountTrakt: 800,
    ratingMetacritic: 75,
    ratingRottenTomatoes: 85,
    runtime: 120,
    budget: 1000000,
    revenue: 5000000,
    status: 'Released',
    theatricalReleaseDate: new Date('2024-01-15'),
    digitalReleaseDate: new Date('2024-03-01'),
    ratingoScore: 0.85,
    qualityScore: 0.8,
    popularityScore: 0.9,
    watchersCount: 100,
    totalWatchers: 500,
    communityAverageRating: 78.5,
    communityRatingCount: 42,
    ...overrides,
  });

  describe('mapExternalRatings', () => {
    it('should map all available ratings', () => {
      const row = createMockRow();
      const result = mapExternalRatings(row);

      expect(result.tmdb).toEqual({ rating: 8.0, voteCount: 1000 });
      expect(result.imdb).toEqual({ rating: 7.5, voteCount: 900 });
      expect(result.trakt).toEqual({ rating: 8.2, voteCount: 800 });
      expect(result.metacritic).toEqual({ rating: 75 });
      expect(result.rottenTomatoes).toEqual({ rating: 85 });
    });

    it('should return null for missing ratings', () => {
      const row = createMockRow({
        ratingImdb: null,
        ratingTrakt: null,
        ratingMetacritic: null,
        ratingRottenTomatoes: null,
      });
      const result = mapExternalRatings(row);

      expect(result.tmdb).toEqual({ rating: 8.0, voteCount: 1000 });
      expect(result.imdb).toBeNull();
      expect(result.trakt).toBeNull();
      expect(result.metacritic).toBeNull();
      expect(result.rottenTomatoes).toBeNull();
    });
  });

  describe('mapRatingoStats', () => {
    it('should map all stats fields', () => {
      const row = createMockRow();
      const result = mapRatingoStats(row);

      expect(result).toEqual({
        ratingoScore: 0.85,
        qualityScore: 0.8,
        popularityScore: 0.9,
        liveWatchers: 100,
        totalWatchers: 500,
        communityAverageRating: 78.5,
        communityRatingCount: 42,
      });
    });

    it('should handle null stats', () => {
      const row = createMockRow({
        ratingoScore: null,
        qualityScore: null,
        popularityScore: null,
        watchersCount: null,
        totalWatchers: null,
        communityAverageRating: null,
        communityRatingCount: null,
      });
      const result = mapRatingoStats(row);

      expect(result).toEqual({
        ratingoScore: null,
        qualityScore: null,
        popularityScore: null,
        liveWatchers: null,
        totalWatchers: null,
        communityAverageRating: null,
        communityRatingCount: null,
      });
    });
  });

  describe('mapMovieDetails', () => {
    const genres = [
      { id: 'g1', name: 'Action', slug: 'action' },
      { id: 'g2', name: 'Drama', slug: 'drama' },
    ];

    const watchOffers: WatchOfferRow[] = [];

    it('should map complete movie details', () => {
      const row = createMockRow();
      const result = mapMovieDetails(row, genres, watchOffers);

      expect(result.id).toBe('m1');
      expect(result.tmdbId).toBe(101);
      expect(result.title).toBe('Test Movie');
      expect(result.originalTitle).toBe('Original Title');
      expect(result.slug).toBe('test-movie');
      expect(result.overview).toBe('Test overview');
      expect(result.ingestionStatus).toBe('ready');
      expect(result.runtime).toBe(120);
      expect(result.budget).toBe(1000000);
      expect(result.revenue).toBe(5000000);
      expect(result.status).toBe('Released');
      expect(result.genres).toEqual(genres);
    });

    it('should extract primary trailer from videos', () => {
      const row = createMockRow({ videos: [{ key: 'trailer1' }, { key: 'trailer2' }] });
      const result = mapMovieDetails(row, genres, watchOffers);

      expect(result.primaryTrailer).toEqual({ key: 'trailer1' });
    });

    it('should handle empty videos array', () => {
      const row = createMockRow({ videos: [] });
      const result = mapMovieDetails(row, genres, watchOffers);

      expect(result.primaryTrailer).toBeNull();
    });

    it('should handle null videos', () => {
      const row = createMockRow({ videos: null });
      const result = mapMovieDetails(row, genres, watchOffers);

      expect(result.primaryTrailer).toBeNull();
    });

    it('should use releaseDate when available', () => {
      const releaseDate = new Date('2024-01-01');
      const row = createMockRow({ releaseDate });
      const result = mapMovieDetails(row, genres, watchOffers);

      expect(result.releaseDate).toEqual(releaseDate);
    });

    it('should fallback to theatricalReleaseDate when releaseDate is null', () => {
      const theatricalReleaseDate = new Date('2024-01-15');
      const row = createMockRow({ releaseDate: null, theatricalReleaseDate });
      const result = mapMovieDetails(row, genres, watchOffers);

      expect(result.releaseDate).toEqual(theatricalReleaseDate);
    });

    it('should return null releaseDate when both are null', () => {
      const row = createMockRow({ releaseDate: null, theatricalReleaseDate: null });
      const result = mapMovieDetails(row, genres, watchOffers);

      expect(result.releaseDate).toBeNull();
    });

    it('should handle null optional fields', () => {
      const row = createMockRow({
        originalTitle: null,
        overview: null,
        runtime: null,
        budget: null,
        revenue: null,
        status: null,
        theatricalReleaseDate: null,
        digitalReleaseDate: null,
      });
      const result = mapMovieDetails(row, genres, watchOffers);

      expect(result.originalTitle).toBeNull();
      expect(result.overview).toBeNull();
      expect(result.runtime).toBeNull();
      expect(result.budget).toBeNull();
      expect(result.revenue).toBeNull();
      expect(result.status).toBeNull();
      expect(result.theatricalReleaseDate).toBeNull();
      expect(result.digitalReleaseDate).toBeNull();
    });

    it('should call ImageMapper for poster and backdrop', () => {
      const row = createMockRow();
      mapMovieDetails(row, genres, watchOffers);

      expect(ImageMapper.toPoster).toHaveBeenCalledWith('/poster.jpg');
      expect(ImageMapper.toBackdrop).toHaveBeenCalledWith('/backdrop.jpg');
    });

    it('should call CreditsMapper.toDto', () => {
      const row = createMockRow();
      mapMovieDetails(row, genres, watchOffers);

      expect(CreditsMapper.toDto).toHaveBeenCalledWith(row.credits);
    });

    it('should call MediaWatchOffersMapper.toAvailability', () => {
      const row = createMockRow();
      mapMovieDetails(row, genres, watchOffers);

      expect(MediaWatchOffersMapper.toAvailability).toHaveBeenCalledWith(
        watchOffers,
        row.watchProvidersRaw,
      );
    });
  });
});
