import { Test, TestingModule } from '@nestjs/testing';
import { SavedItemsService } from './saved-items.service';
import { USER_SAVED_ITEM_REPOSITORY } from '../domain/repositories/user-saved-item.repository.interface';
import { USER_MEDIA_ACTION_REPOSITORY } from '../domain/repositories/user-media-action.repository.interface';
import { SAVED_ITEM_LIST } from '../domain/entities/user-saved-item.entity';
import { USER_MEDIA_ACTION } from '../domain/entities/user-media-action.entity';

describe('SavedItemsService', () => {
  let service: SavedItemsService;
  let savedItemRepo: any;
  let actionRepo: any;

  const mockSavedItem = {
    id: 'saved-id-1',
    userId: 'user-id-1',
    mediaItemId: 'media-id-1',
    list: SAVED_ITEM_LIST.FOR_LATER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSavedItemWithMedia = {
    ...mockSavedItem,
    mediaSummary: {
      id: 'media-id-1',
      type: 'movie',
      title: 'Inception',
      slug: 'inception-2010',
      poster: null,
    },
  };

  beforeEach(async () => {
    savedItemRepo = {
      upsert: jest.fn().mockResolvedValue(mockSavedItem),
      remove: jest.fn().mockResolvedValue(true),
      findListsForMedia: jest.fn().mockResolvedValue([SAVED_ITEM_LIST.FOR_LATER]),
      listWithMedia: jest.fn().mockResolvedValue([mockSavedItemWithMedia]),
      count: jest.fn().mockResolvedValue(1),
    };

    actionRepo = {
      create: jest.fn().mockResolvedValue({ id: 'action-id-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedItemsService,
        { provide: USER_SAVED_ITEM_REPOSITORY, useValue: savedItemRepo },
        { provide: USER_MEDIA_ACTION_REPOSITORY, useValue: actionRepo },
      ],
    }).compile();

    service = module.get<SavedItemsService>(SavedItemsService);
  });

  describe('saveItem', () => {
    it('should save item and log action', async () => {
      const result = await service.saveItem({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        list: SAVED_ITEM_LIST.FOR_LATER,
        context: 'verdict',
        reasonKey: 'trendingNow',
      });

      expect(result).toEqual(mockSavedItem);
      expect(savedItemRepo.upsert).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        list: SAVED_ITEM_LIST.FOR_LATER,
      });
      expect(actionRepo.create).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        action: USER_MEDIA_ACTION.SAVE_FOR_LATER,
        context: 'verdict',
        reasonKey: 'trendingNow',
      });
    });

    it('should use CONSIDER action for considering list', async () => {
      savedItemRepo.upsert.mockResolvedValue({
        ...mockSavedItem,
        list: SAVED_ITEM_LIST.CONSIDERING,
      });

      await service.saveItem({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        list: SAVED_ITEM_LIST.CONSIDERING,
      });

      expect(actionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: USER_MEDIA_ACTION.CONSIDER,
        }),
      );
    });
  });

  describe('unsaveItem', () => {
    it('should remove item and log action when removed', async () => {
      const result = await service.unsaveItem(
        'user-id-1',
        'media-id-1',
        SAVED_ITEM_LIST.FOR_LATER,
        'card',
      );

      expect(result).toBe(true);
      expect(savedItemRepo.remove).toHaveBeenCalledWith(
        'user-id-1',
        'media-id-1',
        SAVED_ITEM_LIST.FOR_LATER,
      );
      expect(actionRepo.create).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        action: USER_MEDIA_ACTION.UNSAVE,
        context: 'card',
        payload: { list: SAVED_ITEM_LIST.FOR_LATER },
      });
    });

    it('should not log action when item not found', async () => {
      savedItemRepo.remove.mockResolvedValue(false);

      const result = await service.unsaveItem('user-id-1', 'media-id-1', SAVED_ITEM_LIST.FOR_LATER);

      expect(result).toBe(false);
      expect(actionRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('getListsForMedia', () => {
    it('should return lists where media is saved', async () => {
      const result = await service.getListsForMedia('user-id-1', 'media-id-1');

      expect(result).toEqual([SAVED_ITEM_LIST.FOR_LATER]);
      expect(savedItemRepo.findListsForMedia).toHaveBeenCalledWith('user-id-1', 'media-id-1');
    });
  });

  describe('listWithMedia', () => {
    it('should return paginated saved items with media', async () => {
      const result = await service.listWithMedia('user-id-1', SAVED_ITEM_LIST.FOR_LATER, 20, 0);

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].mediaSummary.title).toBe('Inception');
      expect(savedItemRepo.count).toHaveBeenCalledWith('user-id-1', SAVED_ITEM_LIST.FOR_LATER);
      expect(savedItemRepo.listWithMedia).toHaveBeenCalledWith(
        'user-id-1',
        SAVED_ITEM_LIST.FOR_LATER,
        20,
        0,
      );
    });
  });
});
