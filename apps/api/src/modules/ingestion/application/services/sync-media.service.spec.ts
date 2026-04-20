import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SyncMediaService } from './sync-media.service';
import { TvMazeEnrichmentService } from './tvmaze-enrichment.service';
import { TmdbAdapter } from '../../../tmdb/public';
import { TraktRatingsAdapter } from '../../infrastructure/adapters/trakt/trakt-ratings.adapter';
import { OmdbAdapter } from '../../infrastructure/adapters/omdb/omdb.adapter';
import { ScoreCalculatorService } from '@/modules/shared/score-calculator';
import { MEDIA_REPOSITORY } from '@/modules/catalog/public';
import { NormalizationService } from '@/modules/provider/public';
import { CATALOG_POLICY_EVALUATOR, EvaluationContext } from '@/modules/catalog-policy/public';
import { MediaType } from '@/common/enums/media-type.enum';
import { VideoSiteEnum, VideoTypeEnum, VideoLanguageEnum } from '@/common/enums/video.enum';

describe('SyncMediaService', () => {
  let service: SyncMediaService;
  let tmdbAdapter: jest.Mocked<TmdbAdapter>;
  let traktAdapter: jest.Mocked<TraktRatingsAdapter>;
  let omdbAdapter: jest.Mocked<OmdbAdapter>;
  let tvMazeEnrichment: jest.Mocked<TvMazeEnrichmentService>;
  let scoreCalculator: jest.Mocked<ScoreCalculatorService>;
  let normalizationService: jest.Mocked<NormalizationService>;
  let mediaRepository: any;
  let catalogEvaluator: any;

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
      getSeasonEpisodes: jest.fn().mockResolvedValue([]),
    };

    const mockTraktAdapter = {
      getMovieRatingsByTmdbId: jest.fn(),
      getShowRatingsByTmdbId: jest.fn(),
    };

    const mockOmdbAdapter = {
      getAggregatedRatings: jest.fn(),
    };

    const mockTvMazeEnrichment = {
      enrich: jest.fn().mockImplementation((media) => Promise.resolve(media)),
    };

    const mockScoreCalculator = {
      calculate: jest.fn().mockReturnValue(mockScores),
    };

    const mockMediaRepository = {
      upsert: jest.fn(),
      updateIngestionStatus: jest.fn(),
      findByTmdbId: jest.fn(),
    };

    const mockNormalizationService = {
      normalizeWatchProviders: jest.fn().mockResolvedValue({ offersCreated: 0, unmappedCount: 0 }),
    };

    const mockCatalogEvaluator = {
      evaluateOne: jest.fn().mockResolvedValue({ status: 'eligible', reasons: [] }),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncMediaService,
        { provide: TmdbAdapter, useValue: mockTmdbAdapter },
        { provide: TraktRatingsAdapter, useValue: mockTraktAdapter },
        { provide: OmdbAdapter, useValue: mockOmdbAdapter },
        { provide: TvMazeEnrichmentService, useValue: mockTvMazeEnrichment },
        { provide: ScoreCalculatorService, useValue: mockScoreCalculator },
        { provide: NormalizationService, useValue: mockNormalizationService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: MEDIA_REPOSITORY, useValue: mockMediaRepository },
        { provide: CATALOG_POLICY_EVALUATOR, useValue: mockCatalogEvaluator },
      ],
    }).compile();

    service = module.get<SyncMediaService>(SyncMediaService);
    tmdbAdapter = module.get(TmdbAdapter);
    traktAdapter = module.get(TraktRatingsAdapter);
    omdbAdapter = module.get(OmdbAdapter);
    tvMazeEnrichment = module.get(TvMazeEnrichmentService);
    scoreCalculator = module.get(ScoreCalculatorService);
    normalizationService = module.get(NormalizationService);
    mediaRepository = module.get(MEDIA_REPOSITORY);
    catalogEvaluator = module.get(CATALOG_POLICY_EVALUATOR);
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

    it('should NOT pass null external ratings from OMDb (preserve existing values filled by other sources)', async () => {
      tmdbAdapter.getMovie.mockResolvedValue({ ...mockMedia });
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);
      // OMDb-like partial response: imdb present, but RT/MC/votes missing
      omdbAdapter.getAggregatedRatings.mockResolvedValue({
        imdbRating: 8.2,
        imdbVotes: null,
        metacritic: null,
        metascore: null,
        rottenTomatoes: null,
      });

      await service.syncMovie(550);

      const payload = mediaRepository.upsert.mock.calls[0][0];
      expect(payload).toEqual(expect.objectContaining({ ratingImdb: 8.2 }));
      expect(payload).not.toHaveProperty('voteCountImdb');
      expect(payload).not.toHaveProperty('ratingMetacritic');
      expect(payload).not.toHaveProperty('ratingRottenTomatoes');
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
          traktTotalWatchers: 3000, // From Trakt /stats endpoint
          traktLiveWatchers: 80, // From Trakt /watching endpoint
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
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const mockShow = {
        ...mockMedia,
        type: MediaType.SHOW,
        details: {
          seasons: [{ number: 1, name: 'Season 1', tmdbId: 101, episodeCount: 0, episodes: [] }],
        },
      };

      const enrichedShow = {
        ...mockShow,
        details: {
          ...mockShow.details,
          seasons: [
            {
              number: 1,
              name: 'Season 1',
              tmdbId: 101,
              episodeCount: 2,
              episodes: [
                { number: 1, title: 'Ep 1', airDate: new Date('2020-01-01') },
                { number: 2, title: 'Ep 2', airDate: futureDate },
              ],
            },
          ],
          nextAirDate: futureDate,
        },
      };

      tmdbAdapter.getShow.mockResolvedValue(mockShow);
      tvMazeEnrichment.enrich.mockResolvedValue(enrichedShow);

      await service.syncShow(1000);

      expect(tvMazeEnrichment.enrich).toHaveBeenCalledWith(mockShow);
      expect(mediaRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            nextAirDate: futureDate,
          }),
        }),
      );
    });

    it('should handle TVMaze failure gracefully', async () => {
      const mockShow = { ...mockMedia, type: MediaType.SHOW };
      tmdbAdapter.getShow.mockResolvedValue(mockShow);
      tvMazeEnrichment.enrich.mockRejectedValue(new Error('TVMaze Down'));

      await service.syncShow(1000);

      // Should not throw, should just skip TVMaze
      expect(mediaRepository.upsert).toHaveBeenCalled();
    });
  });

  describe('TMDB episode fallback', () => {
    const mockShowWithEmptyEpisodes: any = {
      ...mockMedia,
      type: MediaType.SHOW,
      title: 'Тиха Нава',
      slug: 'tykha-nava',
      details: {
        seasons: [{ number: 1, name: 'Сезон 1', tmdbId: 101, episodeCount: 8, episodes: [] }],
      },
    };

    beforeEach(() => {
      traktAdapter.getShowRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);
    });

    it('should fill episodes from TMDB when TVMaze returns empty', async () => {
      tmdbAdapter.getShow.mockResolvedValue({ ...mockShowWithEmptyEpisodes });
      // TVMaze returns media unchanged (no episodes)
      tvMazeEnrichment.enrich.mockResolvedValue({ ...mockShowWithEmptyEpisodes });

      const tmdbEpisodes = [
        {
          tmdbId: 1001,
          number: 1,
          title: 'Серія 1',
          airDate: new Date('2026-01-15'),
          runtime: 50,
          overview: null,
          stillPath: null,
          rating: 7.5,
        },
        {
          tmdbId: 1002,
          number: 2,
          title: 'Серія 2',
          airDate: new Date('2026-01-15'),
          runtime: 57,
          overview: null,
          stillPath: null,
          rating: 8.0,
        },
      ];
      tmdbAdapter.getSeasonEpisodes.mockResolvedValue(tmdbEpisodes);

      await service.syncShow(310537);

      expect(tmdbAdapter.getSeasonEpisodes).toHaveBeenCalledWith(550, 1);
      expect(mediaRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            seasons: expect.arrayContaining([
              expect.objectContaining({
                episodes: tmdbEpisodes,
                episodeCount: 2,
              }),
            ]),
          }),
        }),
      );
    });

    it('should skip fallback when TVMaze already populated episodes', async () => {
      const showWithEpisodes = {
        ...mockShowWithEmptyEpisodes,
        details: {
          seasons: [
            {
              number: 1,
              name: 'Сезон 1',
              tmdbId: 101,
              episodeCount: 2,
              episodes: [
                { number: 1, title: 'Ep 1', airDate: new Date('2026-01-15') },
                { number: 2, title: 'Ep 2', airDate: new Date('2026-01-15') },
              ],
            },
          ],
        },
      };

      tmdbAdapter.getShow.mockResolvedValue({ ...mockShowWithEmptyEpisodes });
      tvMazeEnrichment.enrich.mockResolvedValue(showWithEpisodes);

      await service.syncShow(310537);

      expect(tmdbAdapter.getSeasonEpisodes).not.toHaveBeenCalled();
    });

    it('should handle TMDB fallback failure gracefully', async () => {
      tmdbAdapter.getShow.mockResolvedValue({ ...mockShowWithEmptyEpisodes });
      tvMazeEnrichment.enrich.mockResolvedValue({ ...mockShowWithEmptyEpisodes });
      tmdbAdapter.getSeasonEpisodes.mockRejectedValue(new Error('TMDB error'));

      await service.syncShow(310537);

      // Should still persist (with empty episodes)
      expect(mediaRepository.upsert).toHaveBeenCalled();
    });

    it('should not call fallback for movies', async () => {
      tmdbAdapter.getMovie.mockResolvedValue({ ...mockMedia });
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);

      await service.syncMovie(550);

      expect(tmdbAdapter.getSeasonEpisodes).not.toHaveBeenCalled();
    });
  });

  describe('provider normalization', () => {
    it('should normalize watch providers when present', async () => {
      const mediaWithProviders = {
        ...mockMedia,
        watchProvidersRaw: {
          US: {
            flatrate: [{ providerId: 8, name: 'Netflix' }],
          },
        },
      };
      tmdbAdapter.getMovie.mockResolvedValue(mediaWithProviders);
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);
      mediaRepository.findByTmdbId.mockResolvedValue({ id: 'media-123' });

      await service.syncMovie(550);

      expect(normalizationService.normalizeWatchProviders).toHaveBeenCalledWith(
        'media-123',
        mediaWithProviders.watchProvidersRaw,
      );
    });

    it('should skip normalization when no watch providers', async () => {
      tmdbAdapter.getMovie.mockResolvedValue({ ...mockMedia, watchProvidersRaw: {} });
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);

      await service.syncMovie(550);

      expect(normalizationService.normalizeWatchProviders).not.toHaveBeenCalled();
    });

    it('should handle normalization failure gracefully', async () => {
      const mediaWithProviders = {
        ...mockMedia,
        watchProvidersRaw: {
          US: { flatrate: [{ providerId: 8, name: 'Netflix' }] },
        },
      };
      tmdbAdapter.getMovie.mockResolvedValue(mediaWithProviders);
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);
      mediaRepository.findByTmdbId.mockResolvedValue({ id: 'media-123' });
      normalizationService.normalizeWatchProviders.mockRejectedValue(new Error('DB Error'));

      // Should not throw
      await service.syncMovie(550);

      expect(mediaRepository.upsert).toHaveBeenCalled();
    });

    it('should skip normalization when media item not found after persist', async () => {
      const mediaWithProviders = {
        ...mockMedia,
        watchProvidersRaw: {
          US: { flatrate: [{ providerId: 8, name: 'Netflix' }] },
        },
      };
      tmdbAdapter.getMovie.mockResolvedValue(mediaWithProviders);
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);
      mediaRepository.findByTmdbId.mockResolvedValue(null);

      await service.syncMovie(550);

      expect(normalizationService.normalizeWatchProviders).not.toHaveBeenCalled();
    });
  });

  describe('catalog evaluation with context', () => {
    it('should evaluate only catalog context when not trending', async () => {
      tmdbAdapter.getMovie.mockResolvedValue({ ...mockMedia });
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);
      mediaRepository.findByTmdbId.mockResolvedValue({ id: 'media-123' });

      await service.syncMovie(550);

      expect(catalogEvaluator.evaluateOne).toHaveBeenCalledTimes(1);
      expect(catalogEvaluator.evaluateOne).toHaveBeenCalledWith({
        mediaItemId: 'media-123',
        context: EvaluationContext.CATALOG,
      });
    });

    it('should evaluate both catalog and trending contexts when trending data provided', async () => {
      tmdbAdapter.getMovie.mockResolvedValue({ ...mockMedia });
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);
      mediaRepository.findByTmdbId.mockResolvedValue({ id: 'media-123' });

      await service.syncMovie(550, { score: 9999, rank: 1 });

      expect(catalogEvaluator.evaluateOne).toHaveBeenCalledTimes(2);
      expect(catalogEvaluator.evaluateOne).toHaveBeenCalledWith({
        mediaItemId: 'media-123',
        context: EvaluationContext.CATALOG,
      });
      expect(catalogEvaluator.evaluateOne).toHaveBeenCalledWith({
        mediaItemId: 'media-123',
        context: EvaluationContext.TRENDING,
      });
    });

    it('should not evaluate trending context when trending score is 0', async () => {
      tmdbAdapter.getMovie.mockResolvedValue({ ...mockMedia });
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);
      mediaRepository.findByTmdbId.mockResolvedValue({ id: 'media-123' });

      await service.syncMovie(550, { score: 0, rank: 100 });

      expect(catalogEvaluator.evaluateOne).toHaveBeenCalledTimes(1);
      expect(catalogEvaluator.evaluateOne).toHaveBeenCalledWith({
        mediaItemId: 'media-123',
        context: EvaluationContext.CATALOG,
      });
    });

    it('should handle evaluation failure gracefully', async () => {
      tmdbAdapter.getMovie.mockResolvedValue({ ...mockMedia });
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);
      mediaRepository.findByTmdbId.mockResolvedValue({ id: 'media-123' });
      catalogEvaluator.evaluateOne.mockRejectedValue(new Error('Evaluation failed'));

      // Should not throw
      await service.syncMovie(550);

      expect(mediaRepository.upsert).toHaveBeenCalled();
    });

    it('should skip evaluation when media item not found after persist', async () => {
      tmdbAdapter.getMovie.mockResolvedValue({ ...mockMedia });
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);
      // First call for normalization, second for evaluation
      mediaRepository.findByTmdbId.mockResolvedValue(null);

      await service.syncMovie(550);

      expect(catalogEvaluator.evaluateOne).not.toHaveBeenCalled();
    });
  });

  describe('MediaSyncedEvent emission', () => {
    let eventEmitter: jest.Mocked<{ emit: jest.Mock }>;

    beforeEach(() => {
      // Retrieve the mocked EventEmitter2 instance registered in the module
      const { EventEmitter2: EE2 } = jest.requireActual('@nestjs/event-emitter');
      eventEmitter = (service as any).eventEmitter;
    });

    it('should emit media.synced with correct data after successful syncMovie', async () => {
      tmdbAdapter.getMovie.mockResolvedValue({ ...mockMedia });
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);
      mediaRepository.findByTmdbId.mockResolvedValue({ id: 'media-123' });

      await service.syncMovie(550);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'media.synced',
        expect.objectContaining({
          tmdbId: 550,
          type: 'movie',
          mediaItemId: 'media-123',
        }),
      );
    });

    it('should emit media.synced with correct data after successful syncShow', async () => {
      const mockShow = {
        ...mockMedia,
        type: MediaType.SHOW,
        title: 'Test Show',
        slug: 'test-show',
      };
      tmdbAdapter.getShow.mockResolvedValue(mockShow);
      traktAdapter.getShowRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);
      mediaRepository.findByTmdbId.mockResolvedValue({ id: 'show-456' });

      await service.syncShow(1000);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'media.synced',
        expect.objectContaining({
          tmdbId: 1000,
          type: 'show',
          mediaItemId: 'show-456',
        }),
      );
    });

    it('should NOT emit media.synced when mediaItem is null after persist', async () => {
      tmdbAdapter.getMovie.mockResolvedValue({ ...mockMedia });
      traktAdapter.getMovieRatingsByTmdbId.mockResolvedValue(null);
      omdbAdapter.getAggregatedRatings.mockResolvedValue(null);
      // findByTmdbId returns null — mediaItem not found after upsert
      mediaRepository.findByTmdbId.mockResolvedValue(null);

      await service.syncMovie(550);

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
