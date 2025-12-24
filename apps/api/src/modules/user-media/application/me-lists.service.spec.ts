import { Test, TestingModule } from '@nestjs/testing';
import { MeListsService } from './me-lists.service';
import { UserMediaService } from './user-media.service';
import { USER_MEDIA_LIST_SORT } from '../domain/repositories/user-media-state.repository.interface';
import {
  USER_MEDIA_HISTORY_STATES,
  USER_MEDIA_WATCHLIST_STATES,
} from '../domain/entities/user-media-state.entity';
import { MediaType } from '../../../common/enums/media-type.enum';

describe('MeListsService', () => {
  let service: MeListsService;
  let userMediaService: jest.Mocked<UserMediaService>;

  beforeEach(async () => {
    const mockUserMediaService = {
      countWithMedia: jest.fn(),
      listWithMedia: jest.fn(),
      countActivityWithMedia: jest.fn(),
      listActivityWithMedia: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeListsService,
        {
          provide: UserMediaService,
          useValue: mockUserMediaService,
        },
      ],
    }).compile();

    service = module.get<MeListsService>(MeListsService);
    userMediaService = module.get(UserMediaService);
  });

  describe('getRatings', () => {
    it('should get rated items with total count', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;
      const sort = USER_MEDIA_LIST_SORT.RECENT;

      const mockTotal = 25;
      const mockData = [
        {
          id: '1',
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: 'completed' as const,
          rating: 8.5,
          progress: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          mediaSummary: {
            id: 'media-1',
            type: MediaType.MOVIE,
            title: 'Test Movie',
            slug: 'test-movie',
            poster: null,
            releaseDate: new Date(),
          },
        },
      ];

      userMediaService.countWithMedia.mockResolvedValue(mockTotal);
      userMediaService.listWithMedia.mockResolvedValue(mockData);

      const result = await service.getRatings(userId, limit, offset, sort);

      expect(result).toEqual({ total: mockTotal, data: mockData });
      expect(userMediaService.countWithMedia).toHaveBeenCalledWith(userId, { ratedOnly: true });
      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        ratedOnly: true,
        sort,
      });
    });

    it('should use default sort when not provided', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;

      userMediaService.countWithMedia.mockResolvedValue(0);
      userMediaService.listWithMedia.mockResolvedValue([]);

      await service.getRatings(userId, limit, offset);

      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        ratedOnly: true,
        sort: USER_MEDIA_LIST_SORT.RECENT,
      });
    });

    it('should handle different sort options', async () => {
      const userId = 'user-1';
      const limit = 5;
      const offset = 10;
      const sort = USER_MEDIA_LIST_SORT.RATING;

      userMediaService.countWithMedia.mockResolvedValue(15);
      userMediaService.listWithMedia.mockResolvedValue([]);

      await service.getRatings(userId, limit, offset, sort);

      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        ratedOnly: true,
        sort: USER_MEDIA_LIST_SORT.RATING,
      });
    });

    it('should handle empty results', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;

      userMediaService.countWithMedia.mockResolvedValue(0);
      userMediaService.listWithMedia.mockResolvedValue([]);

      const result = await service.getRatings(userId, limit, offset);

      expect(result).toEqual({ total: 0, data: [] });
    });
  });

  describe('getWatchlist', () => {
    it('should get watchlist items with total count', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;
      const sort = USER_MEDIA_LIST_SORT.RELEASE_DATE;

      const mockTotal = 15;
      const mockData = [
        {
          id: '1',
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: 'planned' as const,
          rating: null,
          progress: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          mediaSummary: {
            id: 'media-1',
            type: MediaType.MOVIE,
            title: 'Movie 1',
            slug: 'movie-1',
            poster: null,
            releaseDate: new Date(),
          },
        },
      ];

      userMediaService.countWithMedia.mockResolvedValue(mockTotal);
      userMediaService.listWithMedia.mockResolvedValue(mockData);

      const result = await service.getWatchlist(userId, limit, offset, sort);

      expect(result).toEqual({ total: mockTotal, data: mockData });
      expect(userMediaService.countWithMedia).toHaveBeenCalledWith(userId, {
        states: USER_MEDIA_WATCHLIST_STATES,
      });
      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        states: USER_MEDIA_WATCHLIST_STATES,
        sort,
      });
    });

    it('should use default sort when not provided', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;

      userMediaService.countWithMedia.mockResolvedValue(0);
      userMediaService.listWithMedia.mockResolvedValue([]);

      await service.getWatchlist(userId, limit, offset);

      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        states: USER_MEDIA_WATCHLIST_STATES,
        sort: USER_MEDIA_LIST_SORT.RECENT,
      });
    });

    it('should handle different sort options for watchlist', async () => {
      const userId = 'user-1';
      const limit = 20;
      const offset = 5;
      const sort = USER_MEDIA_LIST_SORT.RATING;

      userMediaService.countWithMedia.mockResolvedValue(30);
      userMediaService.listWithMedia.mockResolvedValue([]);

      await service.getWatchlist(userId, limit, offset, sort);

      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        states: USER_MEDIA_WATCHLIST_STATES,
        sort: USER_MEDIA_LIST_SORT.RATING,
      });
    });

    it('should handle empty watchlist', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;

      userMediaService.countWithMedia.mockResolvedValue(0);
      userMediaService.listWithMedia.mockResolvedValue([]);

      const result = await service.getWatchlist(userId, limit, offset);

      expect(result).toEqual({ total: 0, data: [] });
    });
  });

  describe('getHistory', () => {
    it('should get history items with total count', async () => {
      const userId = 'user-1';
      const limit = 20;
      const offset = 10;
      const sort = USER_MEDIA_LIST_SORT.RATING;

      const mockTotal = 50;
      const mockData = [
        {
          id: '1',
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: 'completed' as const,
          rating: 9.0,
          progress: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          mediaSummary: {
            id: 'media-1',
            type: MediaType.MOVIE,
            title: 'Watched Movie',
            slug: 'watched-movie',
            poster: null,
            releaseDate: new Date(),
          },
        },
      ];

      userMediaService.countWithMedia.mockResolvedValue(mockTotal);
      userMediaService.listWithMedia.mockResolvedValue(mockData);

      const result = await service.getHistory(userId, limit, offset, sort);

      expect(result).toEqual({ total: mockTotal, data: mockData });
      expect(userMediaService.countWithMedia).toHaveBeenCalledWith(userId, {
        states: USER_MEDIA_HISTORY_STATES,
      });
      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        states: USER_MEDIA_HISTORY_STATES,
        sort,
      });
    });

    it('should use default sort when not provided', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;

      userMediaService.countWithMedia.mockResolvedValue(0);
      userMediaService.listWithMedia.mockResolvedValue([]);

      await service.getHistory(userId, limit, offset);

      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        states: USER_MEDIA_HISTORY_STATES,
        sort: USER_MEDIA_LIST_SORT.RECENT,
      });
    });

    it('should handle different sort options for history', async () => {
      const userId = 'user-1';
      const limit = 15;
      const offset = 20;
      const sort = USER_MEDIA_LIST_SORT.RELEASE_DATE;

      userMediaService.countWithMedia.mockResolvedValue(100);
      userMediaService.listWithMedia.mockResolvedValue([]);

      await service.getHistory(userId, limit, offset, sort);

      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        states: USER_MEDIA_HISTORY_STATES,
        sort: USER_MEDIA_LIST_SORT.RELEASE_DATE,
      });
    });

    it('should handle empty history', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;

      userMediaService.countWithMedia.mockResolvedValue(0);
      userMediaService.listWithMedia.mockResolvedValue([]);

      const result = await service.getHistory(userId, limit, offset);

      expect(result).toEqual({ total: 0, data: [] });
    });
  });

  describe('getActivity', () => {
    it('should get activity items with total count', async () => {
      const userId = 'user-1';
      const limit = 5;
      const offset = 0;

      const mockTotal = 8;
      const mockData = [
        {
          id: '1',
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: 'watching' as const,
          rating: null,
          progress: { seasons: { 1: 5 } },
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          mediaSummary: {
            id: 'media-1',
            type: MediaType.SHOW,
            title: 'TV Show',
            slug: 'tv-show',
            poster: null,
            releaseDate: new Date(),
          },
        },
      ];

      userMediaService.countActivityWithMedia.mockResolvedValue(mockTotal);
      userMediaService.listActivityWithMedia.mockResolvedValue(mockData);

      const result = await service.getActivity(userId, limit, offset);

      expect(result).toEqual({ total: mockTotal, data: mockData });
      expect(userMediaService.countActivityWithMedia).toHaveBeenCalledWith(userId);
      expect(userMediaService.listActivityWithMedia).toHaveBeenCalledWith(userId, limit, offset);
    });

    it('should handle empty activity list', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;

      userMediaService.countActivityWithMedia.mockResolvedValue(0);
      userMediaService.listActivityWithMedia.mockResolvedValue([]);

      const result = await service.getActivity(userId, limit, offset);

      expect(result).toEqual({ total: 0, data: [] });
    });

    it('should handle different pagination parameters', async () => {
      const userId = 'user-2';
      const limit = 20;
      const offset = 10;

      const mockTotal = 25;
      const mockData = [
        {
          id: '2',
          userId: 'user-2',
          mediaItemId: 'media-2',
          state: 'watching' as const,
          rating: 7.5,
          progress: { seasons: { 1: 3, 2: 1 } },
          notes: 'Good show',
          createdAt: new Date(),
          updatedAt: new Date(),
          mediaSummary: {
            id: 'media-2',
            type: MediaType.SHOW,
            title: 'Another Show',
            slug: 'another-show',
            poster: null,
            releaseDate: new Date(),
          },
        },
      ];

      userMediaService.countActivityWithMedia.mockResolvedValue(mockTotal);
      userMediaService.listActivityWithMedia.mockResolvedValue(mockData);

      const result = await service.getActivity(userId, limit, offset);

      expect(result).toEqual({ total: mockTotal, data: mockData });
      expect(userMediaService.countActivityWithMedia).toHaveBeenCalledWith(userId);
      expect(userMediaService.listActivityWithMedia).toHaveBeenCalledWith(userId, limit, offset);
    });
  });
});
