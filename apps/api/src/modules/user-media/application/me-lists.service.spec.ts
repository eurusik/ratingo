import { Test, TestingModule } from '@nestjs/testing';
import { SavedItemsService, SAVED_ITEM_LIST } from '../../user-actions/public';
import { MeListsService } from './me-lists.service';
import { UserMediaService } from './user-media.service';
import {
  FAVORITE_UPDATES_DAYS_AHEAD,
  FAVORITE_UPDATES_DAYS_BACK,
  FAVORITE_UPDATES_LIMIT,
  FAVORITE_UPDATES_RATING_THRESHOLD,
} from '../domain/constants/favorite-updates.constants';
import {
  USER_MEDIA_LIST_SORT,
  USER_MEDIA_STATE_REPOSITORY,
} from '../domain/repositories/user-media-state.repository.interface';
import {
  USER_MEDIA_HISTORY_STATES,
  USER_MEDIA_WATCHLIST_STATES,
  USER_MEDIA_STATE,
} from '../domain/entities/user-media-state.entity';
import { MediaType } from '../../../common/enums/media-type.enum';
import { CardMeta } from '../../shared/cards/domain/card.types';

const mockCard: CardMeta = {
  badgeKey: null,
  primaryCta: 'OPEN',
  continue: null,
};

describe('MeListsService', () => {
  let service: MeListsService;
  let userMediaService: jest.Mocked<UserMediaService>;
  let savedItemsService: jest.Mocked<SavedItemsService>;
  let mockRepo: { listFavoriteUpdates: jest.Mock };

  beforeEach(async () => {
    const mockUserMediaService = {
      countWithMedia: jest.fn(),
      listWithMedia: jest.fn(),
      countActivityWithMedia: jest.fn(),
      listActivityWithMedia: jest.fn(),
    };

    const mockSavedItemsService = {
      countByList: jest.fn(),
    };

    mockRepo = {
      listFavoriteUpdates: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeListsService,
        {
          provide: UserMediaService,
          useValue: mockUserMediaService,
        },
        {
          provide: USER_MEDIA_STATE_REPOSITORY,
          useValue: mockRepo,
        },
        {
          provide: SavedItemsService,
          useValue: mockSavedItemsService,
        },
      ],
    }).compile();

    service = module.get<MeListsService>(MeListsService);
    userMediaService = module.get(UserMediaService);
    savedItemsService = module.get(SavedItemsService);
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
            card: mockCard,
          },
        },
      ];

      userMediaService.countWithMedia.mockResolvedValue(mockTotal);
      userMediaService.listWithMedia.mockResolvedValue(mockData);

      const result = await service.getRatings(userId, limit, offset, sort);

      expect(result).toEqual({ total: mockTotal, data: mockData });
      expect(userMediaService.countWithMedia).toHaveBeenCalledWith(userId, {
        ratedOnly: true,
        type: undefined,
      });
      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        ratedOnly: true,
        sort,
        type: undefined,
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
        type: undefined,
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
        type: undefined,
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
            card: mockCard,
          },
        },
      ];

      userMediaService.countWithMedia.mockResolvedValue(mockTotal);
      userMediaService.listWithMedia.mockResolvedValue(mockData);

      const result = await service.getWatchlist(userId, limit, offset, sort);

      expect(result).toEqual({ total: mockTotal, data: mockData });
      expect(userMediaService.countWithMedia).toHaveBeenCalledWith(userId, {
        states: USER_MEDIA_WATCHLIST_STATES,
        type: undefined,
      });
      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        states: USER_MEDIA_WATCHLIST_STATES,
        sort,
        type: undefined,
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
        type: undefined,
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
        type: undefined,
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
            card: mockCard,
          },
        },
      ];

      userMediaService.countWithMedia.mockResolvedValue(mockTotal);
      userMediaService.listWithMedia.mockResolvedValue(mockData);

      const result = await service.getHistory(userId, limit, offset, sort);

      expect(result).toEqual({ total: mockTotal, data: mockData });
      expect(userMediaService.countWithMedia).toHaveBeenCalledWith(userId, {
        states: USER_MEDIA_HISTORY_STATES,
        type: undefined,
      });
      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        states: USER_MEDIA_HISTORY_STATES,
        sort,
        type: undefined,
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
        type: undefined,
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
        type: undefined,
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

    it('should pass type filter to count and list methods', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;

      userMediaService.countWithMedia.mockResolvedValue(5);
      userMediaService.listWithMedia.mockResolvedValue([]);

      await service.getHistory(userId, limit, offset, undefined, MediaType.SHOW);

      expect(userMediaService.countWithMedia).toHaveBeenCalledWith(userId, {
        states: USER_MEDIA_HISTORY_STATES,
        type: MediaType.SHOW,
      });
      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        states: USER_MEDIA_HISTORY_STATES,
        sort: USER_MEDIA_LIST_SORT.RECENT,
        type: MediaType.SHOW,
      });
    });

    it('should include paused items in history (paused is part of history states)', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;

      userMediaService.countWithMedia.mockResolvedValue(0);
      userMediaService.listWithMedia.mockResolvedValue([]);

      await service.getHistory(userId, limit, offset);

      // Verify that the states filter includes paused
      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(
        userId,
        limit,
        offset,
        expect.objectContaining({
          states: expect.arrayContaining([USER_MEDIA_STATE.PAUSED]),
        }),
      );
    });

    it('should narrow states to [completed] when state=completed is provided', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;

      userMediaService.countWithMedia.mockResolvedValue(0);
      userMediaService.listWithMedia.mockResolvedValue([]);

      await service.getHistory(userId, limit, offset, undefined, undefined, USER_MEDIA_STATE.COMPLETED);

      expect(userMediaService.countWithMedia).toHaveBeenCalledWith(userId, {
        states: [USER_MEDIA_STATE.COMPLETED],
        type: undefined,
      });
      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(
        userId,
        limit,
        offset,
        expect.objectContaining({ states: [USER_MEDIA_STATE.COMPLETED] }),
      );
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
            card: mockCard,
          },
        },
      ];

      userMediaService.countActivityWithMedia.mockResolvedValue(mockTotal);
      userMediaService.listActivityWithMedia.mockResolvedValue(mockData);

      const result = await service.getActivity(userId, limit, offset);

      expect(result).toEqual({ total: mockTotal, data: mockData });
      expect(userMediaService.countActivityWithMedia).toHaveBeenCalledWith(userId, undefined);
      expect(userMediaService.listActivityWithMedia).toHaveBeenCalledWith(
        userId,
        limit,
        offset,
        undefined,
      );
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
            card: mockCard,
          },
        },
      ];

      userMediaService.countActivityWithMedia.mockResolvedValue(mockTotal);
      userMediaService.listActivityWithMedia.mockResolvedValue(mockData);

      const result = await service.getActivity(userId, limit, offset);

      expect(result).toEqual({ total: mockTotal, data: mockData });
      expect(userMediaService.countActivityWithMedia).toHaveBeenCalledWith(userId, undefined);
      expect(userMediaService.listActivityWithMedia).toHaveBeenCalledWith(
        userId,
        limit,
        offset,
        undefined,
      );
    });

    it('should pass type filter to count and list methods', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;

      userMediaService.countActivityWithMedia.mockResolvedValue(3);
      userMediaService.listActivityWithMedia.mockResolvedValue([]);

      await service.getActivity(userId, limit, offset, MediaType.MOVIE);

      expect(userMediaService.countActivityWithMedia).toHaveBeenCalledWith(userId, MediaType.MOVIE);
      expect(userMediaService.listActivityWithMedia).toHaveBeenCalledWith(
        userId,
        limit,
        offset,
        MediaType.MOVIE,
      );
    });
  });

  describe('getPaused', () => {
    it('should get paused items with total count', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;
      const sort = USER_MEDIA_LIST_SORT.RECENT;

      const mockTotal = 5;
      const mockData = [
        {
          id: '1',
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: USER_MEDIA_STATE.PAUSED,
          rating: null,
          progress: { seasons: { 1: 5 } },
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          mediaSummary: {
            id: 'media-1',
            type: MediaType.SHOW,
            title: 'Paused Show',
            slug: 'paused-show',
            poster: null,
            releaseDate: new Date(),
            card: mockCard,
          },
        },
      ];

      userMediaService.countWithMedia.mockResolvedValue(mockTotal);
      userMediaService.listWithMedia.mockResolvedValue(mockData);

      const result = await service.getPaused(userId, limit, offset, sort);

      expect(result).toEqual({ total: mockTotal, data: mockData });
      expect(userMediaService.countWithMedia).toHaveBeenCalledWith(userId, {
        states: [USER_MEDIA_STATE.PAUSED],
        type: undefined,
      });
      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        states: [USER_MEDIA_STATE.PAUSED],
        sort,
        type: undefined,
      });
    });

    it('should use default sort when not provided', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;

      userMediaService.countWithMedia.mockResolvedValue(0);
      userMediaService.listWithMedia.mockResolvedValue([]);

      await service.getPaused(userId, limit, offset);

      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        states: [USER_MEDIA_STATE.PAUSED],
        sort: USER_MEDIA_LIST_SORT.RECENT,
        type: undefined,
      });
    });

    it('should handle empty paused list', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;

      userMediaService.countWithMedia.mockResolvedValue(0);
      userMediaService.listWithMedia.mockResolvedValue([]);

      const result = await service.getPaused(userId, limit, offset);

      expect(result).toEqual({ total: 0, data: [] });
    });
  });

  describe('getDropped', () => {
    it('should get dropped items with total count', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;
      const sort = USER_MEDIA_LIST_SORT.RECENT;

      const mockTotal = 5;
      const mockData = [
        {
          id: '1',
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: USER_MEDIA_STATE.DROPPED,
          rating: null,
          progress: { seasons: { 1: 5 } },
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          mediaSummary: {
            id: 'media-1',
            type: MediaType.SHOW,
            title: 'Dropped Show',
            slug: 'dropped-show',
            poster: null,
            releaseDate: new Date(),
            card: mockCard,
          },
        },
      ];

      userMediaService.countWithMedia.mockResolvedValue(mockTotal);
      userMediaService.listWithMedia.mockResolvedValue(mockData);

      const result = await service.getDropped(userId, limit, offset, sort);

      expect(result).toEqual({ total: mockTotal, data: mockData });
      expect(userMediaService.countWithMedia).toHaveBeenCalledWith(userId, {
        states: [USER_MEDIA_STATE.DROPPED],
        type: undefined,
      });
      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        states: [USER_MEDIA_STATE.DROPPED],
        sort,
        type: undefined,
      });
    });

    it('should use default sort when not provided', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;

      userMediaService.countWithMedia.mockResolvedValue(0);
      userMediaService.listWithMedia.mockResolvedValue([]);

      await service.getDropped(userId, limit, offset);

      expect(userMediaService.listWithMedia).toHaveBeenCalledWith(userId, limit, offset, {
        states: [USER_MEDIA_STATE.DROPPED],
        sort: USER_MEDIA_LIST_SORT.RECENT,
        type: undefined,
      });
    });

    it('should handle empty dropped list', async () => {
      const userId = 'user-1';
      const limit = 10;
      const offset = 0;

      userMediaService.countWithMedia.mockResolvedValue(0);
      userMediaService.listWithMedia.mockResolvedValue([]);

      const result = await service.getDropped(userId, limit, offset);

      expect(result).toEqual({ total: 0, data: [] });
    });
  });

  describe('getFavoriteUpdates', () => {
    it('should pass named constants to repo.listFavoriteUpdates', async () => {
      const userId = 'user-1';
      mockRepo.listFavoriteUpdates.mockResolvedValue([]);

      await service.getFavoriteUpdates(userId);

      expect(mockRepo.listFavoriteUpdates).toHaveBeenCalledWith(userId, {
        ratingThreshold: FAVORITE_UPDATES_RATING_THRESHOLD,
        daysBack: FAVORITE_UPDATES_DAYS_BACK,
        daysAhead: FAVORITE_UPDATES_DAYS_AHEAD,
        limit: FAVORITE_UPDATES_LIMIT,
      });
    });

    it('should return result from repository as-is', async () => {
      const userId = 'user-1';
      const mockItems = [
        {
          mediaItemId: 'media-1',
          rating: 80,
          mediaSummary: {
            id: 'media-1',
            type: MediaType.SHOW,
            title: 'Great Show',
            slug: 'great-show',
            poster: null,
            releaseDate: new Date(),
          },
          latestEpisode: {
            seasonNumber: 2,
            episodeNumber: 5,
            title: 'Episode 5',
            airDate: new Date(),
            isBatchRelease: false,
          },
          nextEpisode: null,
        },
      ];
      mockRepo.listFavoriteUpdates.mockResolvedValue(mockItems);

      const result = await service.getFavoriteUpdates(userId);

      expect(result).toBe(mockItems);
    });

    it('should return empty array when repository returns empty', async () => {
      const userId = 'user-1';
      mockRepo.listFavoriteUpdates.mockResolvedValue([]);

      const result = await service.getFavoriteUpdates(userId);

      expect(result).toEqual([]);
    });
  });

  describe('getListCounts', () => {
    it('aggregates strict state counts from user-media and saved-items services', async () => {
      const userId = 'user-1';
      userMediaService.countWithMedia.mockImplementation(async (_userId, options) => {
        if (options?.states?.includes(USER_MEDIA_STATE.WATCHING)) return 3;
        if (options?.states?.includes(USER_MEDIA_STATE.PAUSED)) return 2;
        if (options?.states?.includes(USER_MEDIA_STATE.DROPPED)) return 5;
        if (options?.states?.includes(USER_MEDIA_STATE.COMPLETED)) return 42;
        if (options?.states?.includes(USER_MEDIA_STATE.CAUGHT_UP)) return 7;
        return 0;
      });
      savedItemsService.countByList.mockImplementation(async (_userId, list) => {
        if (list === SAVED_ITEM_LIST.FOR_LATER) return 10;
        if (list === SAVED_ITEM_LIST.CONSIDERING) return 4;
        return 0;
      });

      const result = await service.getListCounts(userId);

      expect(result).toEqual({
        watching: 3,
        paused: 2,
        dropped: 5,
        completed: 42,
        caughtUp: 7,
        forLater: 10,
        considering: 4,
      });

      expect(userMediaService.countWithMedia).toHaveBeenCalledTimes(5);
      expect(savedItemsService.countByList).toHaveBeenCalledWith(userId, SAVED_ITEM_LIST.FOR_LATER);
      expect(savedItemsService.countByList).toHaveBeenCalledWith(
        userId,
        SAVED_ITEM_LIST.CONSIDERING,
      );
    });

    it('does NOT use the activity OR-progress semantics (would double-count paused-with-progress)', async () => {
      userMediaService.countWithMedia.mockResolvedValue(0);
      savedItemsService.countByList.mockResolvedValue(0);

      await service.getListCounts('user-1');

      // Service must use strict `state=watching`, not the activity OR-semantics.
      expect(userMediaService.countActivityWithMedia).not.toHaveBeenCalled();
      expect(userMediaService.countWithMedia).toHaveBeenCalledWith('user-1', {
        states: [USER_MEDIA_STATE.WATCHING],
      });
    });

    it('returns zeros when user has no items anywhere', async () => {
      userMediaService.countWithMedia.mockResolvedValue(0);
      savedItemsService.countByList.mockResolvedValue(0);

      const result = await service.getListCounts('user-empty');

      expect(result).toEqual({
        watching: 0,
        paused: 0,
        dropped: 0,
        completed: 0,
        caughtUp: 0,
        forLater: 0,
        considering: 0,
      });
    });

    it('dispatches all queries concurrently via Promise.all', async () => {
      userMediaService.countWithMedia.mockResolvedValue(0);
      savedItemsService.countByList.mockResolvedValue(0);

      await service.getListCounts('user-1');

      // 5 state counts (watching/paused/dropped/completed/caught_up) + 2 saved-items counts.
      expect(userMediaService.countWithMedia).toHaveBeenCalledTimes(5);
      expect(savedItemsService.countByList).toHaveBeenCalledTimes(2);
    });
  });
});
