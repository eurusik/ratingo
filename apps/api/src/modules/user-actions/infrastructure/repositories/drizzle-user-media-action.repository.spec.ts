import { Test, TestingModule } from '@nestjs/testing';
import { DrizzleUserMediaActionRepository } from './drizzle-user-media-action.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  const chainMethods = [
    'select',
    'from',
    'where',
    'limit',
    'offset',
    'orderBy',
    'insert',
    'values',
    'returning',
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

describe('DrizzleUserMediaActionRepository', () => {
  let repository: DrizzleUserMediaActionRepository;
  let db: any;

  const mockActionRow = {
    id: 'action-id-1',
    userId: 'user-id-1',
    mediaItemId: 'media-id-1',
    action: 'save_for_later',
    context: 'verdict',
    reasonKey: 'trendingNow',
    payload: { list: 'for_later' },
    createdAt: new Date('2024-01-15T10:00:00Z'),
  };

  const setup = (options: { resolveSelect?: any; resolveInsert?: any; reject?: Error } = {}) => {
    const selectChain = createThenable(options.resolveSelect ?? [], options.reject);
    const insertChain = createThenable(options.resolveInsert ?? [mockActionRow], options.reject);

    db = {
      select: jest.fn().mockReturnValue(selectChain),
      insert: jest.fn().mockReturnValue(insertChain),
    };

    return Test.createTestingModule({
      providers: [DrizzleUserMediaActionRepository, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
  };

  describe('create', () => {
    it('should create an action and return mapped entity', async () => {
      const module = await setup({ resolveInsert: [mockActionRow] });
      repository = module.get(DrizzleUserMediaActionRepository);

      const result = await repository.create({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        action: 'save_for_later',
        context: 'verdict',
        reasonKey: 'trendingNow',
      });

      expect(result).toEqual({
        id: 'action-id-1',
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        action: 'save_for_later',
        context: 'verdict',
        reasonKey: 'trendingNow',
        payload: { list: 'for_later' },
        createdAt: mockActionRow.createdAt,
      });
      expect(db.insert).toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB error') });
      repository = module.get(DrizzleUserMediaActionRepository);

      await expect(
        repository.create({
          userId: 'user-id-1',
          mediaItemId: 'media-id-1',
          action: 'save_for_later',
        }),
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe('listByUser', () => {
    it('should return mapped actions for user', async () => {
      const module = await setup({ resolveSelect: [mockActionRow] });
      repository = module.get(DrizzleUserMediaActionRepository);

      const result = await repository.listByUser('user-id-1', 50, 0);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('action-id-1');
      expect(result[0].action).toBe('save_for_later');
    });

    it('should return empty array when no actions', async () => {
      const module = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleUserMediaActionRepository);

      const result = await repository.listByUser('user-id-1');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB error') });
      repository = module.get(DrizzleUserMediaActionRepository);

      await expect(repository.listByUser('user-id-1')).rejects.toThrow(DatabaseException);
    });
  });

  describe('listByUserAndMedia', () => {
    it('should return actions for specific media', async () => {
      const module = await setup({ resolveSelect: [mockActionRow] });
      repository = module.get(DrizzleUserMediaActionRepository);

      const result = await repository.listByUserAndMedia('user-id-1', 'media-id-1');

      expect(result).toHaveLength(1);
      expect(result[0].mediaItemId).toBe('media-id-1');
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB error') });
      repository = module.get(DrizzleUserMediaActionRepository);

      await expect(repository.listByUserAndMedia('user-id-1', 'media-id-1')).rejects.toThrow(
        DatabaseException,
      );
    });
  });
});
