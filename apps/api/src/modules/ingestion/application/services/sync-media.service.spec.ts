import { Test, TestingModule } from '@nestjs/testing';
import { SyncMediaService } from './sync-media.service';
import { TmdbAdapter } from '@/modules/tmdb/tmdb.adapter';
import { TraktRatingsAdapter } from '../../infrastructure/adapters/trakt/trakt-ratings.adapter';
import { OmdbAdapter } from '../../infrastructure/adapters/omdb/omdb.adapter';
import { TvMazeAdapter } from '../../infrastructure/adapters/tvmaze/tvmaze.adapter';
import { ScoreCalculatorService } from '@/modules/shared/score-calculator';
import { MEDIA_REPOSITORY } from '@/modules/catalog/domain/repositories/media.repository.interface';
import { MediaType } from '@/common/enums/media-type.enum';
import { VideoSiteEnum, VideoTypeEnum, VideoLanguageEnum } from '@/common/enums/video.enum';

describe('SyncMediaService', () => {
  let service: SyncMediaService;
  let tmdbAdapter: jest.Mocked<TmdbAdapter>;
  let traktAdapter: jest.Mocked<TraktRatingsAdapter>;
  let omdbAdapter: jest.Mocked<OmdbAdapter>;
  let tvMazeAdapter: jest.Mocked<TvMazeAdapter>;
  let scoreCalculator: jest.Mocked<ScoreCalculatorService>;
  let mediaRepository: any;

  const mockMedia: any = {
    type: MediaType.MOVIE,
    title: 'Test Movie',
    slug: 'test-movie',
    externalIds: { tmdbId: 550, imdbId: 'tt0137523' },
    popularity: 100,
    rating: 8.5,
    voteCount: 10000,
    releaseDate: new Date('1999-10-15'),
    isAdult: false,
    genres: [],
    credits: { cast: [], crew: [] },
  };

  const mockScores = {
    ratingoScore: 75,
    qualityScore: 80,
    popularityScore: 70,
    freshnessScore: 60,
  };

  beforeEach(async () => {
    const mockTmdbAdapter = {
      getMovie: jest.fn(),
      getShow: jest.fn(),
      getTrending: jest.fn(),
    };

    const mockTraktAdapter = {
      getMovieRatingsByTmdbId: jest.fn(),
      getShowRatingsByTmdbId: jest.fn(),
    };

    const mockOmdbAdapter = {
      getAggregatedRatings: jest.fn(),
    };

    const mockTvMazeAdapter = {
      getEpisodesByImdbId: jest.fn(),
    };

    const mockScoreCalculator = {
      calculate: jest.fn().mockReturnValue(mockScores),
    };

    const mockMediaRepository = {
      upsert: jest.fn(),
      updateIngestionStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncMediaService,
        { provide: TmdbAdapter, useValue: mockTmdbAdapter },
        { provide: TraktRatingsAdapter, useValue: mockTraktAdapter },
        { provide: OmdbAdapter, useValue: mockOmdbAdapter },
        { provide: TvMazeAdapter, useValue: mockTvMazeAdapter },
        { provide: ScoreCalculatorService, useValue: mockScoreCalculator },
        { provide: MEDIA_REPOSITORY, useValue: mockMediaRepository },
      ],
    }).compile();

    service = module.get<SyncMediaService>(SyncMediaService);
    tmdbAdapter = module.get(TmdbAdapter);
    traktAdapter = module.get(TraktRatingsAdapter);
    omdbAdapter = module.get(OmdbAdapter);
    tvMazeAdapter = module.get(TvMazeAdapter);
    scoreCalculator = module.get(ScoreCalculatorService);
    mediaRepository = module.get(MEDIA_REPOSITORY);
  });

  describe('syncMovie', () => {
    it('should sync a movie successfully', async () => {
      tmdbAdapter.getMovie.mockResolvedValue({ ...mockMedia });
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue({
        rating: 8.0,
        votes: 5000,
        watchers: 100,
        totalWatchers: 5000,
      });
      omdbAdapter.getAggregatedRatings.mockResolvedValue({
        imdbRating: 8.8,
        imdbVotes: 2000000,
        metacritic: 66,
        metascore: 66,
        rottenTomatoes: 79,
      });

      await service.syncMovie(550);

      expect(tmdbAdapter.getMovie).toHaveBeenCalledWith(550);
      expect(traktAdapter.getMovieRatingsByTmdbId).toHaveBeenCalledWith(550);
      expect(omdbAdapter.getAggregatedRatings).toHaveBeenCalledWith('tt0137523', MediaType.MOVIE);
      expect(scoreCalculator.calculate).toHaveBeenCalled();
      expect(mediaRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ratingTrakt: 8.0,
          voteCountTrakt: 5000,
          ratingImdb: 8.8,
          voteCountImdb: 2000000,
          ratingMetacritic: 66,
          ratingRottenTomatoes: 79,
          ratingoScore: 75,
        }),
      );
    });

    it('should not sync when movie not found in TMDB', async () => {
      tmdbAdapter.getMovie.mockResolvedValue(null);

      await service.syncMovie(999999);

      expect(traktAdapter.getMovieRatingsByTmdbId).not.toHaveBeenCalled();
      expect(mediaRepository.upsert).not.toHaveBeenCalled();
      expect(mediaRepository.updateIngestionStatus).toHaveBeenCalledWith(
        999999,
        expect.stringMatching(/importing|failed/i),
      );
    });

    it('should sync with trending data when provided', async () => {
      tmdbAdapter.getMovie.mockResolvedValue({ ...mockMedia });
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);

      await service.syncMovie(550, { score: 9999, rank: 1 });

      expect(mediaRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          trendingScore: 9999,
          trendingRank: 1,
        }),
      );
    });

    it('should handle missing IMDb ID gracefully', async () => {
      const mediaWithoutImdb = { ...mockMedia, externalIds: { tmdbId: 550 } };
      tmdbAdapter.getMovie.mockResolvedValue(mediaWithoutImdb);
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue({
        rating: 7.5,
        votes: 3000,
        watchers: 50,
        totalWatchers: 2000,
      });

      await service.syncMovie(550);

      expect(omdbAdapter.getAggregatedRatings).not.toHaveBeenCalled();
      expect(mediaRepository.upsert).toHaveBeenCalled();
    });

    it('should handle null ratings from external sources', async () => {
      tmdbAdapter.getMovie.mockResolvedValue({ ...mockMedia });
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);

      await service.syncMovie(550);

      expect(mediaRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ratingoScore: 75, // Score still calculated
        }),
      );
    });

    it('should throw error on failure for BullMQ retry', async () => {
      tmdbAdapter.getMovie.mockRejectedValue(new Error('TMDB API Error'));

      await expect(service.syncMovie(550)).rejects.toThrow('TMDB API Error');
      expect(mediaRepository.upsert).not.toHaveBeenCalled();
    });

    it('should sync movie with videos', async () => {
      const mockVideos = [
        {
          key: 'dQw4w9WgXcQ',
          name: 'Official Trailer',
          site: VideoSiteEnum.YOUTUBE,
          type: VideoTypeEnum.TRAILER,
          official: true,
          language: VideoLanguageEnum.EN,
          country: 'US',
        },
      ];

      const mediaWithVideos = { ...mockMedia, videos: mockVideos };
      tmdbAdapter.getMovie.mockResolvedValue(mediaWithVideos);

      // Mock other calls with empty/default values
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);

      await service.syncMovie(550);

      expect(mediaRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          videos: mockVideos,
        }),
      );
    });
  });

  describe('syncShow', () => {
    const mockShow = {
      ...mockMedia,
      type: MediaType.SHOW,
      title: 'Test Show',
      slug: 'test-show',
    };

    it('should sync a show successfully', async () => {
      tmdbAdapter.getShow.mockResolvedValue({ ...mockShow });
      traktAdapter.getShowRatingsByTmdbId.mockResolvedValue({
        rating: 8.5,
        votes: 8000,
        watchers: 200,
        totalWatchers: 10000,
      });
      omdbAdapter.getAggregatedRatings.mockResolvedValue({
        imdbRating: 9.0,
        imdbVotes: 1500000,
        metacritic: 80,
        metascore: 80,
        rottenTomatoes: 95,
      });

      await service.syncShow(1000);

      expect(tmdbAdapter.getShow).toHaveBeenCalledWith(1000);
      expect(traktAdapter.getShowRatingsByTmdbId).toHaveBeenCalledWith(1000);
      expect(omdbAdapter.getAggregatedRatings).toHaveBeenCalledWith('tt0137523', MediaType.SHOW);
      expect(mediaRepository.upsert).toHaveBeenCalled();
    });

    it('should not sync when show not found in TMDB', async () => {
      tmdbAdapter.getShow.mockResolvedValue(null);

      await service.syncShow(999999);

      expect(traktAdapter.getShowRatingsByTmdbId).not.toHaveBeenCalled();
      expect(mediaRepository.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getTrending', () => {
    it('should fetch trending media from TMDB', async () => {
      const mockTrending = [
        { tmdbId: 1, type: MediaType.MOVIE },
        { tmdbId: 2, type: MediaType.MOVIE },
        { tmdbId: 100, type: MediaType.SHOW },
      ];
      tmdbAdapter.getTrending.mockResolvedValue(mockTrending);

      const result = await service.getTrending(1);

      expect(result).toEqual(mockTrending);
      expect(tmdbAdapter.getTrending).toHaveBeenCalledWith(1, undefined);
    });

    it('should use default page 1', async () => {
      tmdbAdapter.getTrending.mockResolvedValue([]);

      await service.getTrending();

      expect(tmdbAdapter.getTrending).toHaveBeenCalledWith(1, undefined);
    });
  });

  describe('parallel fetching', () => {
    it('should fetch Trakt and OMDb ratings in parallel', async () => {
      tmdbAdapter.getMovie.mockResolvedValue({ ...mockMedia });

      // Simulate slow API calls
      const traktPromise = new Promise<any>((resolve) =>
        setTimeout(() => resolve({ rating: 8.0, votes: 5000 }), 50),
      );
      const omdbPromise = new Promise<any>((resolve) =>
        setTimeout(() => resolve({ imdbRating: 8.5, imdbVotes: 1000000 }), 50),
      );

      traktAdapter.getMovieRatingsByTmdbId.mockReturnValue(traktPromise);
      omdbAdapter.getAggregatedRatings.mockReturnValue(omdbPromise);

      const start = Date.now();
      await service.syncMovie(550);
      const duration = Date.now() - start;
      // Should complete in ~50ms (parallel) not ~100ms (sequential)
      // Using 250ms threshold to account for CI/test environment variance
      expect(duration).toBeLessThan(250);
    });
  });

  describe('score calculation', () => {
    it('should pass correct data to score calculator', async () => {
      const media = {
        ...mockMedia,
        popularity: 150,
        releaseDate: new Date('2023-06-15'),
      };
      tmdbAdapter.getMovie.mockResolvedValue(media);
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue({
        rating: 7.8,
        votes: 4000,
        watchers: 80,
        totalWatchers: 3000,
      });
      omdbAdapter.getAggregatedRatings.mockResolvedValue({
        imdbRating: 7.5,
        imdbVotes: 50000,
        metacritic: 65,
        metascore: 65,
        rottenTomatoes: 70,
      });

      await service.syncMovie(550);

      expect(scoreCalculator.calculate).toHaveBeenCalledWith(
        expect.objectContaining({
          tmdbPopularity: 150,
          traktWatchers: 0, // Always 0, updated by Stats module
          imdbRating: 7.5,
          traktRating: 7.8,
          metacriticRating: 65,
          rottenTomatoesRating: 70,
          imdbVotes: 50000,
          traktVotes: 4000,
        }),
      );
    });
  });

  describe('TVMaze enrichment', () => {
    it('should enrich show with TVMaze episodes and calculate nextAirDate', async () => {
      const mockShow = {
        ...mockMedia,
        type: MediaType.SHOW,
        details: {
          seasons: [{ number: 1, name: 'Season 1', tmdbId: 101, episodeCount: 0, episodes: [] }],
        },
      };

      tmdbAdapter.getShow.mockResolvedValue(mockShow);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // Next week

      tvMazeAdapter.getEpisodesByImdbId.mockResolvedValue([
        {
          seasonNumber: 1,
          number: 1,
          title: 'Ep 1',
          airDate: new Date('2020-01-01'),
          runtime: 60,
          overview: 'Overview',
          stillPath: null,
          rating: null,
        },
        {
          seasonNumber: 1,
          number: 2,
          title: 'Ep 2',
          airDate: futureDate,
          runtime: 60,
          overview: 'Overview 2',
          stillPath: null,
          rating: null,
        },
      ]);

      await service.syncShow(1000);

      expect(tvMazeAdapter.getEpisodesByImdbId).toHaveBeenCalledWith('tt0137523');
      expect(mediaRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            seasons: expect.arrayContaining([
              expect.objectContaining({
                number: 1,
                name: 'Season 1', // Inherited from TMDB
                episodes: expect.arrayContaining([
                  expect.objectContaining({ title: 'Ep 1' }),
                  expect.objectContaining({ title: 'Ep 2' }),
                ]),
              }),
            ]),
            nextAirDate: futureDate,
          }),
        }),
      );
    });

    it('should handle TVMaze failure gracefully', async () => {
      const mockShow = { ...mockMedia, type: MediaType.SHOW };
      tmdbAdapter.getShow.mockResolvedValue(mockShow);
      tvMazeAdapter.getEpisodesByImdbId.mockRejectedValue(new Error('TVMaze Down'));

      await service.syncShow(1000);

      // Should not throw, should just skip TVMaze
      expect(mediaRepository.upsert).toHaveBeenCalled();
    });
  });
});
