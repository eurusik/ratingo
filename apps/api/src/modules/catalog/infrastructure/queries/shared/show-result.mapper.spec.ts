import { IngestionStatus } from '../../../../../common/enums/ingestion-status.enum';
import { MediaType } from '../../../../../common/enums/media-type.enum';
import { ImageMapper } from '../../../../../common/mappers/image.mapper';
import * as mediaUtils from '../../../../../common/utils/media.utils';

import { calculateReleaseFlags } from './release-flags.util';
import { ShowResultMapper, type ShowProgress } from './show-result.mapper';
import type { ShowSelectRow } from './show-select.fields';

// Mock dependencies
jest.mock('../../../../../common/mappers/image.mapper');
jest.mock('../../../../../common/utils/media.utils');
jest.mock('./release-flags.util');

describe('ShowResultMapper', () => {
  const mockImageMapper = ImageMapper as jest.Mocked<typeof ImageMapper>;
  const mockMediaUtils = mediaUtils as jest.Mocked<typeof mediaUtils>;
  const mockCalculateReleaseFlags = calculateReleaseFlags as jest.MockedFunction<
    typeof calculateReleaseFlags
  >;

  beforeEach(() => {
    jest.clearAllMocks();

    mockImageMapper.toPoster.mockReturnValue({ small: 'poster-small' } as any);
    mockImageMapper.toBackdrop.mockReturnValue({ small: 'backdrop-small' } as any);
    mockMediaUtils.hasRecentEpisode.mockReturnValue(false);
    mockCalculateReleaseFlags.mockReturnValue({ isNew: false, isClassic: false });
  });

  const createMockRow = (overrides: Partial<ShowSelectRow> = {}): ShowSelectRow => ({
    id: 'show-123',
    tmdb_id: 12345,
    title: 'Test Show',
    original_title: 'Original Test Show',
    slug: 'test-show',
    overview: 'A test show overview',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    release_date: new Date('2024-01-15'),
    videos: [{ key: 'trailer1' }, { key: 'trailer2' }],
    ingestion_status: 'ready',
    rating: 8.5,
    vote_count: 2000,
    rating_imdb: 8.0,
    vote_count_imdb: 1500,
    rating_trakt: 8.2,
    vote_count_trakt: 1200,
    rating_metacritic: 75,
    rating_rotten_tomatoes: 85,
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
    ...overrides,
  });

  describe('buildShowProgress', () => {
    it('should build show progress with label when season and episode are present', () => {
      const row = createMockRow({ season_number: 2, episode_number: 5 });

      const result = ShowResultMapper.buildShowProgress(row);

      expect(result).toEqual<ShowProgress>({
        lastAirDate: new Date('2024-06-01'),
        nextAirDate: new Date('2024-06-08'),
        season: 2,
        episode: 5,
        label: 'S2E5',
      });
    });

    it('should build show progress with null label when season is missing', () => {
      const row = createMockRow({ season_number: null, episode_number: 5 });

      const result = ShowResultMapper.buildShowProgress(row);

      expect(result.label).toBeNull();
      expect(result.season).toBeNull();
      expect(result.episode).toBe(5);
    });

    it('should build show progress with null label when episode is missing', () => {
      const row = createMockRow({ season_number: 2, episode_number: null });

      const result = ShowResultMapper.buildShowProgress(row);

      expect(result.label).toBeNull();
      expect(result.season).toBe(2);
      expect(result.episode).toBeNull();
    });

    it('should handle null air dates', () => {
      const row = createMockRow({
        last_air_date: null,
        next_air_date: null,
        season_number: null,
        episode_number: null,
      });

      const result = ShowResultMapper.buildShowProgress(row);

      expect(result).toEqual<ShowProgress>({
        lastAirDate: null,
        nextAirDate: null,
        season: null,
        episode: null,
        label: null,
      });
    });

    it('should convert Date strings to Date objects', () => {
      // Simulate database returning date as string
      const row = createMockRow({
        last_air_date: '2024-06-01T00:00:00.000Z' as unknown as Date,
        next_air_date: '2024-06-08T00:00:00.000Z' as unknown as Date,
      });

      const result = ShowResultMapper.buildShowProgress(row);

      expect(result.lastAirDate).toBeInstanceOf(Date);
      expect(result.nextAirDate).toBeInstanceOf(Date);
    });
  });

  describe('toTrendingItem', () => {
    it('should map a complete row to TrendingShowItem', () => {
      const row = createMockRow();
      mockCalculateReleaseFlags.mockReturnValue({ isNew: true, isClassic: false });

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.id).toBe('show-123');
      expect(result.mediaItemId).toBe('show-123');
      expect(result.type).toBe(MediaType.SHOW);
      expect(result.slug).toBe('test-show');
      expect(result.title).toBe('Test Show');
      expect(result.originalTitle).toBe('Original Test Show');
      expect(result.overview).toBe('A test show overview');
      expect(result.ingestionStatus).toBe(IngestionStatus.READY);
      expect(result.primaryTrailerKey).toBe('trailer1');
      expect(result.isNew).toBe(true);
      expect(result.isClassic).toBe(false);
    });

    it('should call ImageMapper for poster and backdrop', () => {
      const row = createMockRow();

      ShowResultMapper.toTrendingItem(row);

      expect(mockImageMapper.toPoster).toHaveBeenCalledWith('/poster.jpg');
      expect(mockImageMapper.toBackdrop).toHaveBeenCalledWith('/backdrop.jpg');
    });

    it('should call calculateReleaseFlags with correct parameters', () => {
      const row = createMockRow();

      ShowResultMapper.toTrendingItem(row);

      expect(mockCalculateReleaseFlags).toHaveBeenCalledWith(
        new Date('2024-01-15'),
        82, // ratingo_score
        10000, // total_watchers
      );
    });

    it('should call hasRecentEpisode with last_air_date', () => {
      const row = createMockRow();

      ShowResultMapper.toTrendingItem(row);

      expect(mockMediaUtils.hasRecentEpisode).toHaveBeenCalledWith(new Date('2024-06-01'));
    });

    it('should map stats correctly', () => {
      const row = createMockRow();

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.stats).toEqual({
        ratingoScore: 82,
        qualityScore: 80,
        popularityScore: 85,
        liveWatchers: 500,
        totalWatchers: 10000,
        communityAverageRating: null,
        communityRatingCount: null,
      });
    });

    it('should map TMDB ratings correctly', () => {
      const row = createMockRow();

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.externalRatings.tmdb).toEqual({
        rating: 8.5,
        voteCount: 2000,
      });
    });

    it('should map IMDB ratings when available', () => {
      const row = createMockRow({ rating_imdb: 8.0, vote_count_imdb: 1500 });

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.externalRatings.imdb).toEqual({
        rating: 8.0,
        voteCount: 1500,
      });
    });

    it('should return null for IMDB ratings when not available', () => {
      const row = createMockRow({ rating_imdb: null, vote_count_imdb: null });

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.externalRatings.imdb).toBeNull();
    });

    it('should map Trakt ratings when available', () => {
      const row = createMockRow({ rating_trakt: 8.2, vote_count_trakt: 1200 });

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.externalRatings.trakt).toEqual({
        rating: 8.2,
        voteCount: 1200,
      });
    });

    it('should return null for Trakt ratings when not available', () => {
      const row = createMockRow({ rating_trakt: null, vote_count_trakt: null });

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.externalRatings.trakt).toBeNull();
    });

    it('should map Metacritic rating when available', () => {
      const row = createMockRow({ rating_metacritic: 75 });

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.externalRatings.metacritic).toEqual({ rating: 75 });
    });

    it('should return null for Metacritic rating when not available', () => {
      const row = createMockRow({ rating_metacritic: null });

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.externalRatings.metacritic).toBeNull();
    });

    it('should map Rotten Tomatoes rating when available', () => {
      const row = createMockRow({ rating_rotten_tomatoes: 85 });

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.externalRatings.rottenTomatoes).toEqual({ rating: 85 });
    });

    it('should return null for Rotten Tomatoes rating when not available', () => {
      const row = createMockRow({ rating_rotten_tomatoes: null });

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.externalRatings.rottenTomatoes).toBeNull();
    });

    it('should handle null release_date', () => {
      const row = createMockRow({ release_date: null });

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.releaseDate).toBeNull();
      expect(mockCalculateReleaseFlags).toHaveBeenCalledWith(null, 82, 10000);
    });

    it('should handle empty videos array', () => {
      const row = createMockRow({ videos: [] });

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.primaryTrailerKey).toBeNull();
    });

    it('should handle null videos', () => {
      const row = createMockRow({ videos: null });

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.primaryTrailerKey).toBeNull();
    });

    it('should handle video without key property', () => {
      const row = createMockRow({ videos: [{ notKey: 'value' }] });

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.primaryTrailerKey).toBeNull();
    });

    it('should include showProgress in result', () => {
      const row = createMockRow({ season_number: 2, episode_number: 5 });

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.showProgress).toEqual({
        lastAirDate: new Date('2024-06-01'),
        nextAirDate: new Date('2024-06-08'),
        season: 2,
        episode: 5,
        label: 'S2E5',
      });
    });

    it('should handle null stats values', () => {
      const row = createMockRow({
        ratingo_score: null,
        quality_score: null,
        popularity_score: null,
        watchers_count: null,
        total_watchers: null,
      });

      const result = ShowResultMapper.toTrendingItem(row);

      expect(result.stats).toEqual({
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

  describe('mapManyTrending', () => {
    it('should map multiple rows to TrendingShowItem array', () => {
      const rows = [
        createMockRow({ id: 'show-1', title: 'Show 1' }),
        createMockRow({ id: 'show-2', title: 'Show 2' }),
        createMockRow({ id: 'show-3', title: 'Show 3' }),
      ];

      const results = ShowResultMapper.mapManyTrending(rows);

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe('show-1');
      expect(results[0].title).toBe('Show 1');
      expect(results[1].id).toBe('show-2');
      expect(results[1].title).toBe('Show 2');
      expect(results[2].id).toBe('show-3');
      expect(results[2].title).toBe('Show 3');
    });

    it('should return empty array for empty input', () => {
      const results = ShowResultMapper.mapManyTrending([]);

      expect(results).toEqual([]);
    });

    it('should call toTrendingItem for each row', () => {
      const rows = [createMockRow({ id: 'show-1' }), createMockRow({ id: 'show-2' })];

      const spy = jest.spyOn(ShowResultMapper, 'toTrendingItem');

      ShowResultMapper.mapManyTrending(rows);

      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });
  });
});
