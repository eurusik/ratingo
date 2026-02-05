import { IngestionStatus } from '../../../../../common/enums/ingestion-status.enum';
import { ShowStatus } from '../../../../../common/enums/show-status.enum';
import { ImageMapper } from '../../../../../common/mappers/image.mapper';
import { CreditsMapper } from '../../mappers/credits.mapper';
import { MediaWatchOffersMapper } from '../../mappers/media-watch-offers.mapper';

import { mapShowDetails, type ShowDetailsQueryRow } from './show-details.mapper';

// Mock dependencies
jest.mock('../../../../../common/mappers/image.mapper');
jest.mock('../../mappers/credits.mapper');
jest.mock('../../mappers/media-watch-offers.mapper');

describe('show-details.mapper', () => {
  const mockImageMapper = ImageMapper as jest.Mocked<typeof ImageMapper>;
  const mockCreditsMapper = CreditsMapper as jest.Mocked<typeof CreditsMapper>;
  const mockMediaWatchOffersMapper = MediaWatchOffersMapper as jest.Mocked<
    typeof MediaWatchOffersMapper
  >;

  beforeEach(() => {
    jest.clearAllMocks();

    mockImageMapper.toPoster.mockReturnValue({ small: 'poster-small' } as any);
    mockImageMapper.toBackdrop.mockReturnValue({ small: 'backdrop-small' } as any);
    mockCreditsMapper.toDto.mockReturnValue({ cast: [], crew: [] } as any);
    mockMediaWatchOffersMapper.toAvailability.mockReturnValue({
      region: 'UA',
      isFallback: false,
      link: null,
      hint: 'svod',
    } as any);
  });

  const createMockRow = (overrides: Partial<ShowDetailsQueryRow> = {}): ShowDetailsQueryRow => ({
    id: 'show-123',
    tmdbId: 12345,
    title: 'Test Show',
    originalTitle: 'Original Test Show',
    slug: 'test-show',
    overview: 'A test show overview',
    posterPath: '/poster.jpg',
    ingestionStatus: 'ready',
    backdropPath: '/backdrop.jpg',
    videos: [{ key: 'trailer1' }, { key: 'trailer2' }],
    credits: { cast: [] },
    watchProvidersRaw: {},
    rating: 8.5,
    voteCount: 2000,
    releaseDate: new Date('2024-01-15'),
    ratingImdb: 8.0,
    voteCountImdb: 1500,
    ratingTrakt: 8.2,
    voteCountTrakt: 1200,
    ratingMetacritic: 75,
    ratingRottenTomatoes: 85,
    totalSeasons: 3,
    totalEpisodes: 30,
    status: 'Returning Series',
    lastAirDate: new Date('2024-06-01'),
    nextAirDate: new Date('2024-06-08'),
    showId: 'sh-123',
    ratingoScore: 82,
    qualityScore: 80,
    popularityScore: 85,
    watchersCount: 500,
    totalWatchers: 10000,
    ...overrides,
  });

  describe('mapShowDetails', () => {
    const mockGenres = [
      { id: 'g1', name: 'Drama', slug: 'drama' },
      { id: 'g2', name: 'Sci-Fi', slug: 'sci-fi' },
    ];

    const mockSeasons = [
      { number: 1, name: 'Season 1', episodeCount: 10, posterPath: null, airDate: null },
      { number: 2, name: 'Season 2', episodeCount: 10, posterPath: null, airDate: null },
    ];

    const mockWatchOffers: any[] = [];

    it('should map a complete row to ShowDetails', () => {
      const row = createMockRow();

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.id).toBe('show-123');
      expect(result.showId).toBe('sh-123');
      expect(result.tmdbId).toBe(12345);
      expect(result.title).toBe('Test Show');
      expect(result.originalTitle).toBe('Original Test Show');
      expect(result.slug).toBe('test-show');
      expect(result.overview).toBe('A test show overview');
      expect(result.ingestionStatus).toBe(IngestionStatus.READY);
    });

    it('should call ImageMapper for poster and backdrop', () => {
      const row = createMockRow();

      mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(mockImageMapper.toPoster).toHaveBeenCalledWith('/poster.jpg');
      expect(mockImageMapper.toBackdrop).toHaveBeenCalledWith('/backdrop.jpg');
    });

    it('should call CreditsMapper.toDto with credits', () => {
      const row = createMockRow();

      mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(mockCreditsMapper.toDto).toHaveBeenCalledWith({ cast: [] });
    });

    it('should call MediaWatchOffersMapper.toAvailability', () => {
      const row = createMockRow();

      mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(mockMediaWatchOffersMapper.toAvailability).toHaveBeenCalledWith(mockWatchOffers, {});
    });

    it('should map show-specific fields correctly', () => {
      const row = createMockRow();

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.totalSeasons).toBe(3);
      expect(result.totalEpisodes).toBe(30);
      expect(result.status).toBe(ShowStatus.RETURNING_SERIES);
      expect(result.lastAirDate).toEqual(new Date('2024-06-01'));
      expect(result.nextAirDate).toEqual(new Date('2024-06-08'));
    });

    it('should map stats correctly', () => {
      const row = createMockRow();

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.stats).toEqual({
        ratingoScore: 82,
        qualityScore: 80,
        popularityScore: 85,
        liveWatchers: 500,
        totalWatchers: 10000,
      });
    });

    it('should map TMDB ratings correctly', () => {
      const row = createMockRow();

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.externalRatings.tmdb).toEqual({
        rating: 8.5,
        voteCount: 2000,
      });
    });

    it('should map IMDB ratings when available', () => {
      const row = createMockRow({ ratingImdb: 8.0, voteCountImdb: 1500 });

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.externalRatings.imdb).toEqual({
        rating: 8.0,
        voteCount: 1500,
      });
    });

    it('should return null for IMDB ratings when not available', () => {
      const row = createMockRow({ ratingImdb: null, voteCountImdb: null });

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.externalRatings.imdb).toBeNull();
    });

    it('should map Trakt ratings when available', () => {
      const row = createMockRow({ ratingTrakt: 8.2, voteCountTrakt: 1200 });

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.externalRatings.trakt).toEqual({
        rating: 8.2,
        voteCount: 1200,
      });
    });

    it('should return null for Trakt ratings when not available', () => {
      const row = createMockRow({ ratingTrakt: null, voteCountTrakt: null });

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.externalRatings.trakt).toBeNull();
    });

    it('should map Metacritic rating when available', () => {
      const row = createMockRow({ ratingMetacritic: 75 });

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.externalRatings.metacritic).toEqual({ rating: 75 });
    });

    it('should return null for Metacritic rating when not available', () => {
      const row = createMockRow({ ratingMetacritic: null });

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.externalRatings.metacritic).toBeNull();
    });

    it('should map Rotten Tomatoes rating when available', () => {
      const row = createMockRow({ ratingRottenTomatoes: 85 });

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.externalRatings.rottenTomatoes).toEqual({ rating: 85 });
    });

    it('should return null for Rotten Tomatoes rating when not available', () => {
      const row = createMockRow({ ratingRottenTomatoes: null });

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.externalRatings.rottenTomatoes).toBeNull();
    });

    it('should extract primary trailer from videos array', () => {
      const row = createMockRow({ videos: [{ key: 'trailer1' }, { key: 'trailer2' }] });

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.primaryTrailer).toEqual({ key: 'trailer1' });
    });

    it('should return null for primary trailer when videos is empty', () => {
      const row = createMockRow({ videos: [] });

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.primaryTrailer).toBeNull();
    });

    it('should return null for primary trailer when videos is null', () => {
      const row = createMockRow({ videos: null });

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.primaryTrailer).toBeNull();
    });

    it('should include genres in result', () => {
      const row = createMockRow();

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.genres).toHaveLength(2);
      expect(result.genres[0].name).toBe('Drama');
      expect(result.genres[1].name).toBe('Sci-Fi');
    });

    it('should include seasons in result', () => {
      const row = createMockRow();

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.seasons).toHaveLength(2);
      expect(result.seasons[0].number).toBe(1);
      expect(result.seasons[1].number).toBe(2);
    });

    it('should handle null stats values', () => {
      const row = createMockRow({
        ratingoScore: null,
        qualityScore: null,
        popularityScore: null,
        watchersCount: null,
        totalWatchers: null,
      });

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.stats).toEqual({
        ratingoScore: null,
        qualityScore: null,
        popularityScore: null,
        liveWatchers: null,
        totalWatchers: null,
      });
    });

    it('should handle null show-specific fields', () => {
      const row = createMockRow({
        totalSeasons: null,
        totalEpisodes: null,
        status: null,
        lastAirDate: null,
        nextAirDate: null,
      });

      const result = mapShowDetails(row, mockGenres, mockSeasons, mockWatchOffers);

      expect(result.totalSeasons).toBeNull();
      expect(result.totalEpisodes).toBeNull();
      expect(result.status).toBeNull();
      expect(result.lastAirDate).toBeNull();
      expect(result.nextAirDate).toBeNull();
    });
  });

  describe('ShowDetailsQueryRow', () => {
    it('should have correct nullable fields', () => {
      // This is a compile-time check - the test passes if it compiles
      const mockRow: ShowDetailsQueryRow = {
        id: 'test-id',
        tmdbId: 12345,
        title: 'Test Show',
        originalTitle: null,
        slug: 'test-show',
        overview: null,
        posterPath: null,
        ingestionStatus: 'ready',
        backdropPath: null,
        videos: null,
        credits: null,
        watchProvidersRaw: null,
        rating: 7.5,
        voteCount: 1000,
        releaseDate: null,
        ratingImdb: null,
        voteCountImdb: null,
        ratingTrakt: null,
        voteCountTrakt: null,
        ratingMetacritic: null,
        ratingRottenTomatoes: null,
        totalSeasons: null,
        totalEpisodes: null,
        status: null,
        lastAirDate: null,
        nextAirDate: null,
        showId: 'sh-1',
        ratingoScore: null,
        qualityScore: null,
        popularityScore: null,
        watchersCount: null,
        totalWatchers: null,
      };

      expect(mockRow.id).toBe('test-id');
      expect(mockRow.originalTitle).toBeNull();
    });

    it('should accept valid non-null values', () => {
      const mockRow: ShowDetailsQueryRow = createMockRow();

      expect(mockRow.ratingImdb).toBe(8.0);
      expect(mockRow.totalSeasons).toBe(3);
    });
  });
});
