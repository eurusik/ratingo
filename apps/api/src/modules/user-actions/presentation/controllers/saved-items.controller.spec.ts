import { Test, TestingModule } from '@nestjs/testing';
import { SavedItemsController } from './saved-items.controller';
import { SavedItemsService } from '../../application/saved-items.service';
import { SAVED_ITEM_LIST } from '../../domain/entities/user-saved-item.entity';

describe('SavedItemsController', () => {
  let controller: SavedItemsController;
  let service: jest.Mocked<SavedItemsService>;

  const mockUser = { id: 'user-id-1' };

  const mockSavedItem = {
    id: 'saved-id-1',
    userId: 'user-id-1',
    mediaItemId: 'media-id-1',
    list: SAVED_ITEM_LIST.FOR_LATER,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  };

  const mockSavedItemWithMedia = {
    ...mockSavedItem,
    mediaSummary: {
      id: 'media-id-1',
      type: 'movie' as const,
      title: 'Inception',
      slug: 'inception-2010',
      poster: null,
      releaseDate: new Date('2010-07-16'),
    },
  };

  beforeEach(async () => {
    const mockService = {
      saveItem: jest.fn().mockResolvedValue(mockSavedItem),
      unsaveItem: jest.fn().mockResolvedValue(true),
      getListsForMedia: jest.fn().mockResolvedValue([SAVED_ITEM_LIST.FOR_LATER]),
      listWithMedia: jest.fn().mockResolvedValue({ total: 1, data: [mockSavedItemWithMedia] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavedItemsController],
      providers: [{ provide: SavedItemsService, useValue: mockService }],
    }).compile();

    controller = module.get<SavedItemsController>(SavedItemsController);
    service = module.get(SavedItemsService);
  });

  describe('saveItem', () => {
    it('should save item and return response', async () => {
      const result = await controller.saveItem(mockUser, 'media-id-1', {
        list: SAVED_ITEM_LIST.FOR_LATER,
        context: 'verdict',
        reasonKey: 'trendingNow',
      });

      expect(result).toEqual({
        id: 'saved-id-1',
        mediaItemId: 'media-id-1',
        list: SAVED_ITEM_LIST.FOR_LATER,
        status: {
          isForLater: true,
          isConsidering: false,
        },
        createdAt: mockSavedItem.createdAt,
      });
      expect(service.saveItem).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        list: SAVED_ITEM_LIST.FOR_LATER,
        context: 'verdict',
        reasonKey: 'trendingNow',
      });
    });
  });

  describe('unsaveItem', () => {
    it('should unsave item and return result', async () => {
      const result = await controller.unsaveItem(mockUser, 'media-id-1', {
        list: SAVED_ITEM_LIST.FOR_LATER,
        context: 'card',
      });

      expect(result).toEqual({
        removed: true,
        status: {
          isForLater: true,
          isConsidering: false,
        },
      });
      expect(service.unsaveItem).toHaveBeenCalledWith(
        'user-id-1',
        'media-id-1',
        SAVED_ITEM_LIST.FOR_LATER,
        'card',
      );
    });
  });

  describe('getStatus', () => {
    it('should return lists where media is saved', async () => {
      const result = await controller.getStatus(mockUser, 'media-id-1');

      expect(result).toEqual({
        isForLater: true,
        isConsidering: false,
      });
      expect(service.getListsForMedia).toHaveBeenCalledWith('user-id-1', 'media-id-1');
    });
  });

  describe('listForLater', () => {
    it('should return paginated for_later items', async () => {
      const result = await controller.listForLater(mockUser, 20, 0);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.hasMore).toBe(false);
      expect(service.listWithMedia).toHaveBeenCalledWith(
        'user-id-1',
        SAVED_ITEM_LIST.FOR_LATER,
        20,
        0,
      );
    });

    it('should use default pagination values', async () => {
      await controller.listForLater(mockUser);

      expect(service.listWithMedia).toHaveBeenCalledWith(
        'user-id-1',
        SAVED_ITEM_LIST.FOR_LATER,
        20,
        0,
      );
    });
  });

  describe('listConsidering', () => {
    it('should return paginated considering items', async () => {
      service.listWithMedia.mockResolvedValue({ total: 0, data: [] });

      const result = await controller.listConsidering(mockUser, 10, 5);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(service.listWithMedia).toHaveBeenCalledWith(
        'user-id-1',
        SAVED_ITEM_LIST.CONSIDERING,
        10,
        5,
      );
    });
  });
});
