import { Test, TestingModule } from '@nestjs/testing';
import { MeListsController } from './me-lists.controller';
import { MeListsService } from '../../application/me-lists.service';
import { USER_MEDIA_LIST_SORT } from '../../domain/repositories/user-media-state.repository.interface';
import { MediaType } from '../../../../common/enums/media-type.enum';

describe('MeListsController', () => {
  let controller: MeListsController;
  let meListsService: jest.Mocked<MeListsService>;

  const mockUser = { id: 'user-1' };
  const mockMediaSummary = {
    id: 'media-1',
    type: MediaType.MOVIE,
    title: 'Test Movie',
    slug: 'test-movie',
    poster: null,
    releaseDate: new Date('2023-01-01'),
  };

  const mockUserMediaWithSummary = {
    id: 'user-media-1',
    userId: 'user-1',
    mediaItemId: 'media-1',
    state: 'completed' as const,
    rating: 8.5,
    progress: { seasons: { 1: 10 } },
    notes: 'Great movie!',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02'),
    mediaSummary: mockMediaSummary,
  };

  beforeEach(async () => {
    const mockMeListsService = {
      getRatings: jest.fn(),
      getWatchlist: jest.fn(),
      getHistory: jest.fn(),
      getActivity: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeListsController],
      providers: [
        {
          provide: MeListsService,
          useValue: mockMeListsService,
        },
      ],
    }).compile();

    controller = module.get<MeListsController>(MeListsController);
    meListsService = module.get(MeListsService);
  });

  describe('ratings', () => {
    it('should return paginated ratings list', async () => {
      const query = { limit: 10, offset: 0, sort: USER_MEDIA_LIST_SORT.RECENT };
      const mockServiceResponse = {
        total: 25,
        data: [mockUserMediaWithSummary],
      };

      meListsService.getRatings.mockResolvedValue(mockServiceResponse);

      const result = await controller.ratings(mockUser, query);

      expect(result).toEqual({
        data: [
          {
            id: 'user-media-1',
            userId: 'user-1',
            mediaItemId: 'media-1',
            state: 'completed',
            rating: 8.5,
            progress: { seasons: { 1: 10 } },
            notes: 'Great movie!',
            createdAt: mockUserMediaWithSummary.createdAt,
            updatedAt: mockUserMediaWithSummary.updatedAt,
            mediaSummary: mockMediaSummary,
          },
        ],
        meta: {
          count: 1,
          total: 25,
          limit: 10,
          offset: 0,
          hasMore: true,
        },
      });

      expect(meListsService.getRatings).toHaveBeenCalledWith(
        'user-1',
        10,
        0,
        USER_MEDIA_LIST_SORT.RECENT,
      );
    });

    it('should use default pagination values', async () => {
      const query = {};
      const mockServiceResponse = { total: 0, data: [] };

      meListsService.getRatings.mockResolvedValue(mockServiceResponse);

      await controller.ratings(mockUser, query);

      expect(meListsService.getRatings).toHaveBeenCalledWith('user-1', 20, 0, undefined);
    });

    it('should calculate hasMore correctly when no more items', async () => {
      const query = { limit: 10, offset: 20 };
      const mockServiceResponse = {
        total: 25,
        data: [
          mockUserMediaWithSummary,
          { ...mockUserMediaWithSummary, id: 'user-media-2' },
          { ...mockUserMediaWithSummary, id: 'user-media-3' },
          { ...mockUserMediaWithSummary, id: 'user-media-4' },
          { ...mockUserMediaWithSummary, id: 'user-media-5' },
        ],
      };

      meListsService.getRatings.mockResolvedValue(mockServiceResponse);

      const result = await controller.ratings(mockUser, query);

      expect(result.meta.hasMore).toBe(false);
    });
  });

  describe('watchlist', () => {
    it('should return paginated watchlist', async () => {
      const query = { limit: 15, offset: 5, sort: USER_MEDIA_LIST_SORT.RELEASE_DATE };
      const mockServiceResponse = {
        total: 30,
        data: [mockUserMediaWithSummary],
      };

      meListsService.getWatchlist.mockResolvedValue(mockServiceResponse);

      const result = await controller.watchlist(mockUser, query);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        count: 1,
        total: 30,
        limit: 15,
        offset: 5,
        hasMore: true,
      });

      expect(meListsService.getWatchlist).toHaveBeenCalledWith(
        'user-1',
        15,
        5,
        USER_MEDIA_LIST_SORT.RELEASE_DATE,
      );
    });

    it('should handle empty watchlist', async () => {
      const query = {};
      const mockServiceResponse = { total: 0, data: [] };

      meListsService.getWatchlist.mockResolvedValue(mockServiceResponse);

      const result = await controller.watchlist(mockUser, query);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.hasMore).toBe(false);
    });

    it('should use default values when query is empty', async () => {
      const query = {};
      const mockServiceResponse = { total: 5, data: [] };

      meListsService.getWatchlist.mockResolvedValue(mockServiceResponse);

      await controller.watchlist(mockUser, query);

      expect(meListsService.getWatchlist).toHaveBeenCalledWith('user-1', 20, 0, undefined);
    });

    it('should calculate hasMore correctly for watchlist', async () => {
      const query = { limit: 10, offset: 0 };
      const mockServiceResponse = {
        total: 5,
        data: Array(5).fill(mockUserMediaWithSummary),
      };

      meListsService.getWatchlist.mockResolvedValue(mockServiceResponse);

      const result = await controller.watchlist(mockUser, query);

      expect(result.meta.hasMore).toBe(false); // 0 + 5 = 5, not < 5
    });
  });

  describe('history', () => {
    it('should return paginated history', async () => {
      const query = { limit: 5, offset: 10, sort: USER_MEDIA_LIST_SORT.RATING };
      const mockServiceResponse = {
        total: 50,
        data: [mockUserMediaWithSummary, { ...mockUserMediaWithSummary, id: 'user-media-2' }],
      };

      meListsService.getHistory.mockResolvedValue(mockServiceResponse);

      const result = await controller.history(mockUser, query);

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        count: 2,
        total: 50,
        limit: 5,
        offset: 10,
        hasMore: true,
      });

      expect(meListsService.getHistory).toHaveBeenCalledWith(
        'user-1',
        5,
        10,
        USER_MEDIA_LIST_SORT.RATING,
      );
    });

    it('should use default values for history', async () => {
      const query = {};
      const mockServiceResponse = { total: 0, data: [] };

      meListsService.getHistory.mockResolvedValue(mockServiceResponse);

      await controller.history(mockUser, query);

      expect(meListsService.getHistory).toHaveBeenCalledWith('user-1', 20, 0, undefined);
    });

    it('should handle large history dataset', async () => {
      const query = { limit: 100, offset: 500 };
      const mockServiceResponse = {
        total: 1000,
        data: Array(100).fill(mockUserMediaWithSummary),
      };

      meListsService.getHistory.mockResolvedValue(mockServiceResponse);

      const result = await controller.history(mockUser, query);

      expect(result.data).toHaveLength(100);
      expect(result.meta.hasMore).toBe(true); // 500 + 100 = 600 < 1000
    });
  });

  describe('activity', () => {
    it('should return paginated activity list', async () => {
      const query = { limit: 8, offset: 0 };
      const mockServiceResponse = {
        total: 12,
        data: [mockUserMediaWithSummary],
      };

      meListsService.getActivity.mockResolvedValue(mockServiceResponse);

      const result = await controller.activity(mockUser, query);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        count: 1,
        total: 12,
        limit: 8,
        offset: 0,
        hasMore: true,
      });

      expect(meListsService.getActivity).toHaveBeenCalledWith('user-1', 8, 0);
    });

    it('should not pass sort parameter to activity service', async () => {
      const query = { sort: USER_MEDIA_LIST_SORT.RELEASE_DATE };
      const mockServiceResponse = { total: 0, data: [] };

      meListsService.getActivity.mockResolvedValue(mockServiceResponse);

      await controller.activity(mockUser, query);

      // Activity endpoint doesn't support sorting, so sort should not be passed
      expect(meListsService.getActivity).toHaveBeenCalledWith('user-1', 20, 0);
    });

    it('should use default pagination for activity', async () => {
      const query = {};
      const mockServiceResponse = { total: 3, data: [] };

      meListsService.getActivity.mockResolvedValue(mockServiceResponse);

      await controller.activity(mockUser, query);

      expect(meListsService.getActivity).toHaveBeenCalledWith('user-1', 20, 0);
    });

    it('should handle empty activity', async () => {
      const query = { limit: 10, offset: 0 };
      const mockServiceResponse = { total: 0, data: [] };

      meListsService.getActivity.mockResolvedValue(mockServiceResponse);

      const result = await controller.activity(mockUser, query);

      expect(result.data).toEqual([]);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('mapItem', () => {
    it('should correctly map user media item', () => {
      // Access private method for testing
      const mapItem = (controller as any).mapItem.bind(controller);

      const result = mapItem(mockUserMediaWithSummary);

      expect(result).toEqual({
        id: 'user-media-1',
        userId: 'user-1',
        mediaItemId: 'media-1',
        state: 'completed',
        rating: 8.5,
        progress: { seasons: { 1: 10 } },
        notes: 'Great movie!',
        createdAt: mockUserMediaWithSummary.createdAt,
        updatedAt: mockUserMediaWithSummary.updatedAt,
        mediaSummary: mockMediaSummary,
      });
    });
  });
});
