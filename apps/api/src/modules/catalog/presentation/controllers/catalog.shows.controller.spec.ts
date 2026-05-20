import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CardEnrichmentService } from '../../../shared/cards/application/card-enrichment.service';
import { ShowsCalendarService } from '../../application/services/shows-calendar.service';
import { CatalogUserStateEnricher } from '../../application/services/catalog-userstate-enricher.service';
import { ShowDetailsService } from '../../application/services/show-details.service';
import { ShowNotFoundError } from '../../domain/errors';
import { SHOW_REPOSITORY } from '../../domain/repositories/show.repository.interface';

import { CatalogShowsController } from './catalog.shows.controller';

describe('CatalogShowsController', () => {
  let controller: CatalogShowsController;
  let showRepository: any;
  let userStateEnricher: any;
  let showDetailsService: any;
  let showsCalendarService: any;

  beforeEach(async () => {
    const mockShowRepository = {
      findTrending: jest
        .fn()
        .mockResolvedValue([{ id: 'trending-1', title: 'Trending Show', type: 'show' }]),
      findPopular: jest
        .fn()
        .mockResolvedValue([{ id: 'popular-1', title: 'Popular Show', type: 'show' }]),
      findNewEpisodes: jest.fn().mockResolvedValue([]),
      findEpisodesByDateRange: jest.fn().mockResolvedValue([
        { airDate: new Date('2024-01-01T10:00:00Z'), title: 'Ep1' },
        { airDate: new Date('2024-01-01T11:00:00Z'), title: 'Ep2' },
        { airDate: new Date('2024-01-02T10:00:00Z'), title: 'Ep3' },
      ]),
      findBySlug: jest.fn(),
    };

    const mockCards = {
      enrichCatalogItems: jest.fn((items: any[]) => items),
    };

    const mockUserStateEnricher = {
      enrichItemList: jest.fn(async (_userId: string | null, items: any[]) =>
        items.map((i) => ({ ...i, userState: null })),
      ),
      enrichOne: jest.fn(async (_userId: string | null, item: any) => ({
        ...item,
        userState: null,
      })),
    };

    const mockShowDetailsService = {
      getBySlug: jest.fn(),
    };

    const mockShowsCalendarService = {
      getWatchingShowsCount: jest.fn().mockResolvedValue(3),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogShowsController],
      providers: [
        { provide: SHOW_REPOSITORY, useValue: mockShowRepository },
        { provide: CatalogUserStateEnricher, useValue: mockUserStateEnricher },
        { provide: CardEnrichmentService, useValue: mockCards },
        { provide: ShowDetailsService, useValue: mockShowDetailsService },
        { provide: ShowsCalendarService, useValue: mockShowsCalendarService },
      ],
    }).compile();

    controller = module.get<CatalogShowsController>(CatalogShowsController);
    showRepository = module.get(SHOW_REPOSITORY);
    userStateEnricher = module.get(CatalogUserStateEnricher);
    showDetailsService = module.get(ShowDetailsService);
    showsCalendarService = module.get(ShowsCalendarService);
  });

  describe('getTrendingShows', () => {
    it('returns trending shows with meta', async () => {
      const result = await controller.getTrendingShows({ limit: 10, offset: 0 } as any, null);

      expect(showRepository.findTrending).toHaveBeenCalledWith({ limit: 10, offset: 0 });
      expect(result.meta).toEqual({ count: 1, total: 1, limit: 10, offset: 0, hasMore: false });
      expect(userStateEnricher.enrichItemList).toHaveBeenCalled();
    });
  });

  describe('getPopularShows', () => {
    it('returns popular shows with meta', async () => {
      const result = await controller.getPopularShows({ limit: 10, offset: 0 } as any, null);

      expect(showRepository.findPopular).toHaveBeenCalledWith({ limit: 10, offset: 0 });
      expect(result.meta).toEqual({ count: 1, total: 1, limit: 10, offset: 0, hasMore: false });
      expect(userStateEnricher.enrichItemList).toHaveBeenCalled();
    });
  });

  describe('getCalendar', () => {
    it('groups episodes by date', async () => {
      const result = await controller.getCalendar('2024-01-01', 7);

      expect(showRepository.findEpisodesByDateRange).toHaveBeenCalled();
      expect(result.days).toHaveLength(2);
      expect(result.days.find((d) => d.date === '2024-01-01')?.episodes).toHaveLength(2);
    });

    it('throws UnauthorizedException for personalized=true without authenticated user', async () => {
      await expect(controller.getCalendar('2024-01-01', 7, 'true', null)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('passes userId to repository for personalized=true with authenticated user', async () => {
      await controller.getCalendar('2024-01-01', 7, 'true', { id: 'user-abc' });

      expect(showRepository.findEpisodesByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        { userId: 'user-abc' },
      );
    });

    it('does not filter by user when personalized is not set', async () => {
      await controller.getCalendar('2024-01-01', 7, undefined, { id: 'user-abc' });

      expect(showRepository.findEpisodesByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
      );
    });

    it('returns watchingShowsCount in response for personalized=true', async () => {
      const result = await controller.getCalendar('2024-01-01', 7, 'true', { id: 'user-abc' });

      expect(result.watchingShowsCount).toBe(3);
    });

    it('does not include watchingShowsCount for non-personalized requests', async () => {
      const result = await controller.getCalendar('2024-01-01', 7, undefined, null);

      expect(result.watchingShowsCount).toBeUndefined();
      expect(showsCalendarService.getWatchingShowsCount).not.toHaveBeenCalled();
    });
  });

  describe('getShowBySlug', () => {
    it('returns details with card when found', async () => {
      const mockShowResult = {
        id: '2',
        title: 'Arcane',
        slug: 'arcane',
        releaseDate: null,
        nextAirDate: null,
        externalRatings: {
          imdb: null,
          tmdb: null,
          trakt: null,
          metacritic: null,
          rottenTomatoes: null,
        },
        userState: null,
        card: { badgeKey: null },
        verdict: { type: 'general', messageKey: null, context: null, hintKey: 'decideToWatch' },
        statusHint: null,
      };
      showDetailsService.getBySlug.mockResolvedValue(mockShowResult);

      const result = await controller.getShowBySlug('arcane');

      expect(showDetailsService.getBySlug).toHaveBeenCalledWith('arcane', undefined);
      expect(result.id).toBe('2');
      expect(result.userState).toBeNull();
      expect(result.card).toBeDefined();
      expect(result.card.badgeKey).toBeNull();
    });

    it('delegates to ShowDetailsService with userId', async () => {
      const mockShowResult = {
        id: '2',
        title: 'Arcane',
        userState: { state: 'watching' },
        card: { badgeKey: null },
        verdict: { type: 'general', messageKey: null, context: null, hintKey: 'decideToWatch' },
        statusHint: null,
      };
      showDetailsService.getBySlug.mockResolvedValue(mockShowResult);

      const result = await controller.getShowBySlug('arcane', { id: 'user-123' });

      expect(showDetailsService.getBySlug).toHaveBeenCalledWith('arcane', 'user-123');
      expect(result.userState).toEqual({ state: 'watching' });
    });

    it('throws ShowNotFoundError when not found', async () => {
      showDetailsService.getBySlug.mockRejectedValue(new ShowNotFoundError('missing'));

      await expect(controller.getShowBySlug('missing')).rejects.toThrow(ShowNotFoundError);
    });
  });
});
