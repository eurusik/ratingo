import { Test, TestingModule } from '@nestjs/testing';

import { ShowStatus } from '../../../../common/enums/show-status.enum';
import { ShowNotFoundError } from '../../domain/errors';
import { SHOW_REPOSITORY } from '../../domain/repositories/show.repository.interface';

import { CatalogUserStateEnricher } from './catalog-userstate-enricher.service';
import { ShowDetailsService } from './show-details.service';

describe('ShowDetailsService', () => {
  let service: ShowDetailsService;
  let showRepository: any;
  let userStateEnricher: any;

  const mockShow = {
    id: 'media-1',
    showId: 'show-1',
    tmdbId: 123,
    title: 'Test Show',
    originalTitle: 'Test Show Original',
    slug: 'test-show',
    overview: 'A test show',
    ingestionStatus: 'ready',
    poster: null,
    backdrop: null,
    videos: null,
    primaryTrailer: null,
    credits: null,
    availability: null,
    releaseDate: new Date('2024-06-01'),
    totalSeasons: 3,
    totalEpisodes: 30,
    status: ShowStatus.RETURNING_SERIES,
    lastAirDate: new Date('2024-12-01'),
    nextAirDate: null,
    genres: [{ id: 'g1', name: 'Drama', slug: 'drama' }],
    seasons: [],
    stats: {
      ratingoScore: 75,
      qualityScore: 70,
      popularityScore: 60,
      liveWatchers: 100,
      totalWatchers: 5000,
    },
    externalRatings: {
      imdb: { rating: 8.5, voteCount: 50000 },
      tmdb: { rating: 8.2, voteCount: 10000 },
      trakt: null,
      metacritic: { rating: 82 },
      rottenTomatoes: null,
    },
  };

  beforeEach(async () => {
    const mockShowRepository = {
      findBySlug: jest.fn(),
    };

    const mockUserStateEnricher = {
      enrichOne: jest.fn(async (_userId: string | null, item: any) => ({
        ...item,
        userState: null,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShowDetailsService,
        { provide: SHOW_REPOSITORY, useValue: mockShowRepository },
        { provide: CatalogUserStateEnricher, useValue: mockUserStateEnricher },
      ],
    }).compile();

    service = module.get<ShowDetailsService>(ShowDetailsService);
    showRepository = module.get(SHOW_REPOSITORY);
    userStateEnricher = module.get(CatalogUserStateEnricher);
  });

  describe('getBySlug', () => {
    it('should return enriched show details when found', async () => {
      showRepository.findBySlug.mockResolvedValue(mockShow);

      const result = await service.getBySlug('test-show');

      expect(showRepository.findBySlug).toHaveBeenCalledWith('test-show');
      expect(userStateEnricher.enrichOne).toHaveBeenCalled();
      expect(result.id).toBe('media-1');
      expect(result.title).toBe('Test Show');
      expect(result.userState).toBeNull();
    });

    it('should throw ShowNotFoundError when show not found', async () => {
      showRepository.findBySlug.mockResolvedValue(null);

      await expect(service.getBySlug('unknown-show')).rejects.toThrow(ShowNotFoundError);
      await expect(service.getBySlug('unknown-show')).rejects.toThrow(
        'Show with slug "unknown-show" not found',
      );
    });

    it('should include card metadata in response', async () => {
      showRepository.findBySlug.mockResolvedValue(mockShow);

      const result = await service.getBySlug('test-show');

      expect(result.card).toBeDefined();
    });

    it('should include verdict in response', async () => {
      showRepository.findBySlug.mockResolvedValue(mockShow);

      const result = await service.getBySlug('test-show');

      expect(result.verdict).toBeDefined();
      expect(result.verdict.type).toBeDefined();
      expect(result.verdict.hintKey).toBeDefined();
    });

    it('should pass userId to enricher when provided', async () => {
      showRepository.findBySlug.mockResolvedValue(mockShow);

      await service.getBySlug('test-show', 'user-123');

      expect(userStateEnricher.enrichOne).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ id: 'media-1' }),
      );
    });

    it('should pass null userId to enricher when not provided', async () => {
      showRepository.findBySlug.mockResolvedValue(mockShow);

      await service.getBySlug('test-show');

      expect(userStateEnricher.enrichOne).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ id: 'media-1' }),
      );
    });

    it('should include userState from enricher in response', async () => {
      const mockUserState = {
        mediaItemId: 'media-1',
        state: 'watching',
        progress: { season: 2, episode: 5 },
      };
      userStateEnricher.enrichOne.mockResolvedValue({
        ...mockShow,
        userState: mockUserState,
      });
      showRepository.findBySlug.mockResolvedValue(mockShow);

      const result = await service.getBySlug('test-show', 'user-123');

      expect(result.userState).toEqual(mockUserState);
    });

    it('should handle show with null stats gracefully', async () => {
      const showWithNullStats = {
        ...mockShow,
        stats: null,
      };
      showRepository.findBySlug.mockResolvedValue(showWithNullStats);

      const result = await service.getBySlug('test-show');

      expect(result).toBeDefined();
      expect(result.verdict).toBeDefined();
    });

    it('should handle show with null externalRatings gracefully', async () => {
      const showWithNullRatings = {
        ...mockShow,
        externalRatings: {
          imdb: null,
          tmdb: null,
          trakt: null,
          metacritic: null,
          rottenTomatoes: null,
        },
      };
      showRepository.findBySlug.mockResolvedValue(showWithNullRatings);

      const result = await service.getBySlug('test-show');

      expect(result).toBeDefined();
      expect(result.verdict).toBeDefined();
    });

    it('should include statusHint for ended shows', async () => {
      const endedShow = {
        ...mockShow,
        status: ShowStatus.ENDED,
      };
      showRepository.findBySlug.mockResolvedValue(endedShow);

      const result = await service.getBySlug('test-show');

      expect(result.statusHint).toBeDefined();
      expect(result.statusHint?.messageKey).toBe('seriesFinale');
    });

    it('should return null statusHint for cancelled shows', async () => {
      const cancelledShow = {
        ...mockShow,
        status: ShowStatus.CANCELED,
        externalRatings: {
          imdb: { rating: 8.5, voteCount: 50000 },
          tmdb: null,
          trakt: null,
          metacritic: null,
          rottenTomatoes: null,
        },
      };
      showRepository.findBySlug.mockResolvedValue(cancelledShow);

      const result = await service.getBySlug('test-show');

      expect(result.verdict.messageKey).toBe('cancelled');
      expect(result.statusHint).toBeNull();
    });
  });
});
