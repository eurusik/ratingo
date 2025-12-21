import { Test, TestingModule } from '@nestjs/testing';
import { DrizzleUserSavedItemRepository } from './drizzle-user-saved-item.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { SAVED_ITEM_LIST } from '../../domain/entities/user-saved-item.entity';

const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  const chainMethods = [
    'select',
    'from',
    'where',
    'groupBy',
    'as',
    'limit',
    'offset',
    'orderBy',
    'insert',
    'values',
    'returning',
    'onConflictDoUpdate',
    'delete',
    'innerJoin',
    'leftJoin',
  ];
  chainMethods.forEach((m) => {
    thenable[m] = jest.fn().mockReturnValue(thenable);
  });

  if (rejectWith) {
    thenable.then = (_res: any, rej: any) => Promise.reject(rejectWith).catch(rej);
  } else {
    thenable.then = (res: any) => Promise.resolve(resolveWith).then(res);
  }
  return thenable;
};

describe('DrizzleUserSavedItemRepository', () => {
  let repository: DrizzleUserSavedItemRepository;
  let db: any;

  const mockSavedItemRow = {
    id: 'saved-id-1',
    userId: 'user-id-1',
    mediaItemId: 'media-id-1',
    list: 'for_later',
    reasonKey: null,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  };

  const mockMediaRow = {
    id: 'media-id-1',
    type: 'movie',
    title: 'Inception',
    slug: 'inception-2010',
    posterPath: '/poster.jpg',
    releaseDate: new Date('2010-07-16'),
  };

  const setup = (
    options: {
      resolveSelect?: any;
      resolveInsert?: any;
      resolveDelete?: any;
      reject?: Error;
    } = {},
  ) => {
    const selectChain = createThenable(options.resolveSelect ?? [], options.reject);
    const insertChain = createThenable(options.resolveInsert ?? [mockSavedItemRow], options.reject);
    const deleteChain = createThenable(
      options.resolveDelete ?? [{ id: 'saved-id-1' }],
      options.reject,
    );

    db = {
      select: jest.fn().mockReturnValue(selectChain),
      insert: jest.fn().mockReturnValue(insertChain),
      delete: jest.fn().mockReturnValue(deleteChain),
    };

    return Test.createTestingModule({
      providers: [DrizzleUserSavedItemRepository, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
  };

  describe('upsert', () => {
    it('should upsert a saved item and return mapped entity', async () => {
      const module = await setup({ resolveInsert: [mockSavedItemRow] });
      repository = module.get(DrizzleUserSavedItemRepository);

      const result = await repository.upsert({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        list: SAVED_ITEM_LIST.FOR_LATER,
      });

      expect(result).toEqual({
        id: 'saved-id-1',
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        list: 'for_later',
        reasonKey: null,
        createdAt: mockSavedItemRow.createdAt,
        updatedAt: mockSavedItemRow.updatedAt,
      });
      expect(db.insert).toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB error') });
      repository = module.get(DrizzleUserSavedItemRepository);

      await expect(
        repository.upsert({
          userId: 'user-id-1',
          mediaItemId: 'media-id-1',
          list: SAVED_ITEM_LIST.FOR_LATER,
        }),
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe('remove', () => {
    it('should return true when item is deleted', async () => {
      const module = await setup({ resolveDelete: [{ id: 'saved-id-1' }] });
      repository = module.get(DrizzleUserSavedItemRepository);

      const result = await repository.remove('user-id-1', 'media-id-1', SAVED_ITEM_LIST.FOR_LATER);

      expect(result).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });

    it('should return false when no item deleted', async () => {
      const module = await setup({ resolveDelete: [] });
      repository = module.get(DrizzleUserSavedItemRepository);

      const result = await repository.remove('user-id-1', 'media-id-1', SAVED_ITEM_LIST.FOR_LATER);

      expect(result).toBe(false);
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB error') });
      repository = module.get(DrizzleUserSavedItemRepository);

      await expect(
        repository.remove('user-id-1', 'media-id-1', SAVED_ITEM_LIST.FOR_LATER),
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe('findOne', () => {
    it('should return saved item when found', async () => {
      const module = await setup({ resolveSelect: [mockSavedItemRow] });
      repository = module.get(DrizzleUserSavedItemRepository);

      const result = await repository.findOne('user-id-1', 'media-id-1', SAVED_ITEM_LIST.FOR_LATER);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('saved-id-1');
    });

    it('should return null when not found', async () => {
      const module = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleUserSavedItemRepository);

      const result = await repository.findOne('user-id-1', 'media-id-1', SAVED_ITEM_LIST.FOR_LATER);

      expect(result).toBeNull();
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB error') });
      repository = module.get(DrizzleUserSavedItemRepository);

      await expect(
        repository.findOne('user-id-1', 'media-id-1', SAVED_ITEM_LIST.FOR_LATER),
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe('findListsForMedia', () => {
    it('should return lists where media is saved', async () => {
      const module = await setup({
        resolveSelect: [{ list: 'for_later' }, { list: 'considering' }],
      });
      repository = module.get(DrizzleUserSavedItemRepository);

      const result = await repository.findListsForMedia('user-id-1', 'media-id-1');

      expect(result).toEqual(['for_later', 'considering']);
    });

    it('should return empty array when not saved', async () => {
      const module = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleUserSavedItemRepository);

      const result = await repository.findListsForMedia('user-id-1', 'media-id-1');

      expect(result).toEqual([]);
    });
  });

  describe('listWithMedia', () => {
    it('should return saved items with media summary', async () => {
      const module = await setup({
        resolveSelect: [{ item: mockSavedItemRow, media: mockMediaRow }],
      });
      repository = module.get(DrizzleUserSavedItemRepository);

      const result = await repository.listWithMedia('user-id-1', SAVED_ITEM_LIST.FOR_LATER);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('saved-id-1');
      expect(result[0].mediaSummary).toBeDefined();
      expect(result[0].mediaSummary.title).toBe('Inception');
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB error') });
      repository = module.get(DrizzleUserSavedItemRepository);

      await expect(
        repository.listWithMedia('user-id-1', SAVED_ITEM_LIST.FOR_LATER),
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe('count', () => {
    it('should return count of saved items', async () => {
      const module = await setup({ resolveSelect: [{ count: 5 }] });
      repository = module.get(DrizzleUserSavedItemRepository);

      const result = await repository.count('user-id-1', SAVED_ITEM_LIST.FOR_LATER);

      expect(result).toBe(5);
    });

    it('should return 0 when no items', async () => {
      const module = await setup({ resolveSelect: [{ count: 0 }] });
      repository = module.get(DrizzleUserSavedItemRepository);

      const result = await repository.count('user-id-1', SAVED_ITEM_LIST.FOR_LATER);

      expect(result).toBe(0);
    });
  });
});
