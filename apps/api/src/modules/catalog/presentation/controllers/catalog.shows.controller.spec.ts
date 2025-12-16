import { Test, TestingModule } from '@nestjs/testing';
import { CatalogShowsController } from './catalog.shows.controller';
import { SHOW_REPOSITORY } from '../../domain/repositories/show.repository.interface';
import { CatalogUserStateEnricher } from '../../application/services/catalog-userstate-enricher.service';
import { CardEnrichmentService } from '../../../shared/cards/application/card-enrichment.service';
import { NotFoundException } from '@nestjs/common';

describe('CatalogShowsController', () => {
  let controller: CatalogShowsController;
  let showRepository: any;
  let userStateEnricher: any;
  let cards: any;

  beforeEach(async () => {
    const mockShowRepository = {
      findTrending: jest
        .fn()
        .mockResolvedValue([{ id: 'trending-1', title: 'Trending Show', type: 'show' }]),
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
      enrichList: jest.fn(async (_userId: string | null, items: any[]) =>
        items.map((i) => ({ ...i, userState: null })),
      ),
      enrichOne: jest.fn(async (_userId: string | null, item: any) => ({
        ...item,
        userState: null,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogShowsController],
      providers: [
        { provide: SHOW_REPOSITORY, useValue: mockShowRepository },
        { provide: CatalogUserStateEnricher, useValue: mockUserStateEnricher },
        { provide: CardEnrichmentService, useValue: mockCards },
      ],
    }).compile();

    controller = module.get<CatalogShowsController>(CatalogShowsController);
    showRepository = module.get(SHOW_REPOSITORY);
    userStateEnricher = module.get(CatalogUserStateEnricher);
    cards = module.get(CardEnrichmentService);
  });

  describe('getTrendingShows', () => {
    it('returns trending shows with meta', async () => {
      const result = await controller.getTrendingShows({ limit: 10, offset: 0 } as any, null);

      expect(showRepository.findTrending).toHaveBeenCalledWith({ limit: 10, offset: 0 });
      expect(result.meta).toEqual({ count: 1, total: 1, limit: 10, offset: 0, hasMore: false });
    });
  });

  describe('getCalendar', () => {
    it('groups episodes by date', async () => {
      const result = await controller.getCalendar('2024-01-01', 7);

      expect(showRepository.findEpisodesByDateRange).toHaveBeenCalled();
      expect(result.days).toHaveLength(2);
      expect(result.days.find((d) => d.date === '2024-01-01')?.episodes).toHaveLength(2);
    });
  });

  describe('getShowBySlug', () => {
    it('returns details with card when found', async () => {
      const mockShow = {
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
      };
      showRepository.findBySlug.mockResolvedValue(mockShow);

      const result = await controller.getShowBySlug('arcane');
      expect(showRepository.findBySlug).toHaveBeenCalledWith('arcane');
      expect(result.id).toBe('2');
      expect(result.userState).toBeNull();
      expect(result.card).toBeDefined();
      expect(result.card.badgeKey).toBeNull(); // No badge for default context without signals
    });

    it('throws NotFoundException when not found', async () => {
      showRepository.findBySlug.mockResolvedValue(null);
      await expect(controller.getShowBySlug('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
