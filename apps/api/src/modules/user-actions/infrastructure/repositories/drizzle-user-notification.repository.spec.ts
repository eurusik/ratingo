import { Test, TestingModule } from '@nestjs/testing';
import { DrizzleUserNotificationRepository } from './drizzle-user-notification.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

describe('DrizzleUserNotificationRepository', () => {
  let repository: DrizzleUserNotificationRepository;
  let mockDb: any;

  const mockNotificationRow = {
    id: 'notif-1',
    userId: 'user-1',
    mediaItemId: 'media-1',
    subscriptionId: 'sub-1',
    trigger: 'new_season',
    payload: { seasonNumber: 3 },
    isRead: false,
    readAt: null,
    createdAt: new Date('2025-01-15T10:00:00Z'),
  };

  const mockMediaRow = {
    id: 'media-1',
    type: 'show',
    title: 'Breaking Bad',
    slug: 'breaking-bad',
    posterPath: '/poster.jpg',
  };

  const createMockChain = (returnValue: any[] = [], shouldReject = false) => {
    const chain: any = {
      values: jest.fn().mockReturnThis(),
      onConflictDoNothing: jest.fn().mockReturnThis(),
      returning: shouldReject
        ? jest.fn().mockRejectedValue(new Error('DB error'))
        : jest.fn().mockResolvedValue(returnValue),
    };
    return chain;
  };

  const createSelectChain = (returnValue: any[] = [], shouldReject = false) => {
    const chain: any = {
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
    };
    if (shouldReject) {
      chain.then = (_: any, rej: any) => Promise.reject(new Error('DB error')).catch(rej);
    } else {
      chain.then = (res: any) => Promise.resolve(returnValue).then(res);
    }
    return chain;
  };

  const createUpdateChain = (returnValue: any[] = [], shouldReject = false) => {
    const chain: any = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: shouldReject
        ? jest.fn().mockRejectedValue(new Error('DB error'))
        : jest.fn().mockResolvedValue(returnValue),
    };
    return chain;
  };

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn(),
      select: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrizzleUserNotificationRepository,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
      ],
    }).compile();

    repository = module.get<DrizzleUserNotificationRepository>(DrizzleUserNotificationRepository);
  });

  describe('createMany - exactly-once invariant', () => {
    it('should use onConflictDoNothing to prevent duplicates', async () => {
      const insertChain = createMockChain([{ id: 'n1' }, { id: 'n2' }]);
      mockDb.insert.mockReturnValue(insertChain);

      const events = [
        {
          userId: 'user-1',
          mediaItemId: 'media-1',
          subscriptionId: 'sub-1',
          trigger: 'new_season' as const,
          payload: { seasonNumber: 3 },
        },
        {
          userId: 'user-2',
          mediaItemId: 'media-1',
          subscriptionId: 'sub-2',
          trigger: 'new_season' as const,
          payload: { seasonNumber: 3 },
        },
      ];

      await repository.createMany(events);

      expect(insertChain.onConflictDoNothing).toHaveBeenCalled();
    });

    it('should return count of actually created notifications', async () => {
      const insertChain = createMockChain([{ id: 'n1' }, { id: 'n2' }]);
      mockDb.insert.mockReturnValue(insertChain);

      const events = [
        { userId: 'u1', mediaItemId: 'm1', subscriptionId: 's1', trigger: 'new_season' as const },
        { userId: 'u2', mediaItemId: 'm1', subscriptionId: 's2', trigger: 'new_season' as const },
        { userId: 'u1', mediaItemId: 'm1', subscriptionId: 's1', trigger: 'new_season' as const },
      ];

      const count = await repository.createMany(events);

      expect(count).toBe(2);
    });

    it('should return 0 for empty array', async () => {
      const count = await repository.createMany([]);
      expect(count).toBe(0);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const insertChain = createMockChain([], true);
      mockDb.insert.mockReturnValue(insertChain);

      await expect(
        repository.createMany([
          { userId: 'u1', mediaItemId: 'm1', subscriptionId: 's1', trigger: 'new_season' as const },
        ]),
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe('create - single notification', () => {
    it('should create notification and return entity', async () => {
      const insertChain = createMockChain([mockNotificationRow]);
      mockDb.insert.mockReturnValue(insertChain);

      const result = await repository.create({
        userId: 'user-1',
        mediaItemId: 'media-1',
        subscriptionId: 'sub-1',
        trigger: 'new_season',
        payload: { seasonNumber: 3 },
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe('notif-1');
      expect(result?.trigger).toBe('new_season');
    });

    it('should return null on duplicate (conflict ignored)', async () => {
      const insertChain = createMockChain([]);
      mockDb.insert.mockReturnValue(insertChain);

      const result = await repository.create({
        userId: 'user-1',
        mediaItemId: 'media-1',
        subscriptionId: 'sub-1',
        trigger: 'new_season',
      });

      expect(result).toBeNull();
    });

    it('should throw DatabaseException on error', async () => {
      const insertChain = createMockChain([], true);
      mockDb.insert.mockReturnValue(insertChain);

      await expect(
        repository.create({
          userId: 'user-1',
          mediaItemId: 'media-1',
          subscriptionId: 'sub-1',
          trigger: 'new_season',
        }),
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe('listWithMedia', () => {
    it('should return notifications with media summary', async () => {
      const selectChain = createSelectChain([
        { notification: mockNotificationRow, media: mockMediaRow },
      ]);
      mockDb.select.mockReturnValue(selectChain);

      const result = await repository.listWithMedia('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('notif-1');
      expect(result[0].mediaSummary.title).toBe('Breaking Bad');
    });

    it('should return empty array when no notifications', async () => {
      const selectChain = createSelectChain([]);
      mockDb.select.mockReturnValue(selectChain);

      const result = await repository.listWithMedia('user-1');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseException on error', async () => {
      const selectChain = createSelectChain([], true);
      mockDb.select.mockReturnValue(selectChain);

      await expect(repository.listWithMedia('user-1')).rejects.toThrow(DatabaseException);
    });
  });

  describe('countUnread', () => {
    it('should return count of unread notifications', async () => {
      const selectChain = createSelectChain([{ count: 5 }]);
      mockDb.select.mockReturnValue(selectChain);

      const result = await repository.countUnread('user-1');

      expect(result).toBe(5);
    });

    it('should call innerJoin to filter deleted media', async () => {
      const selectChain = createSelectChain([{ count: 5 }]);
      mockDb.select.mockReturnValue(selectChain);

      await repository.countUnread('user-1');

      expect(selectChain.innerJoin).toHaveBeenCalled();
    });

    it('should return 0 when no unread', async () => {
      const selectChain = createSelectChain([{ count: 0 }]);
      mockDb.select.mockReturnValue(selectChain);

      const result = await repository.countUnread('user-1');

      expect(result).toBe(0);
    });

    it('should throw DatabaseException on error', async () => {
      const selectChain = createSelectChain([], true);
      mockDb.select.mockReturnValue(selectChain);

      await expect(repository.countUnread('user-1')).rejects.toThrow(DatabaseException);
    });
  });

  describe('countTotal', () => {
    it('should return count of total notifications', async () => {
      const selectChain = createSelectChain([{ count: 10 }]);
      mockDb.select.mockReturnValue(selectChain);

      const result = await repository.countTotal('user-1');

      expect(result).toBe(10);
    });

    it('should call innerJoin to filter deleted media', async () => {
      const selectChain = createSelectChain([{ count: 10 }]);
      mockDb.select.mockReturnValue(selectChain);

      await repository.countTotal('user-1');

      expect(selectChain.innerJoin).toHaveBeenCalled();
    });

    it('should return 0 when no notifications', async () => {
      const selectChain = createSelectChain([{ count: 0 }]);
      mockDb.select.mockReturnValue(selectChain);

      const result = await repository.countTotal('user-1');

      expect(result).toBe(0);
    });

    it('should throw DatabaseException on error', async () => {
      const selectChain = createSelectChain([], true);
      mockDb.select.mockReturnValue(selectChain);

      await expect(repository.countTotal('user-1')).rejects.toThrow(DatabaseException);
    });

    it('should add unread filter when unread is true', async () => {
      const selectChain = createSelectChain([{ count: 3 }]);
      mockDb.select.mockReturnValue(selectChain);

      const result = await repository.countTotal('user-1', true);

      expect(result).toBe(3);
    });
  });

  describe('markAsRead - single notification', () => {
    it('should mark notification as read and return true', async () => {
      const updateChain = createUpdateChain([{ id: 'notif-1' }]);
      mockDb.update.mockReturnValue(updateChain);

      const result = await repository.markAsRead('notif-1', 'user-1');

      expect(result).toBe(true);
      expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ isRead: true }));
    });

    it('should return false when notification not found', async () => {
      const updateChain = createUpdateChain([]);
      mockDb.update.mockReturnValue(updateChain);

      const result = await repository.markAsRead('notif-999', 'user-1');

      expect(result).toBe(false);
    });

    it('should throw DatabaseException on error', async () => {
      const updateChain = createUpdateChain([], true);
      mockDb.update.mockReturnValue(updateChain);

      await expect(repository.markAsRead('notif-1', 'user-1')).rejects.toThrow(DatabaseException);
    });
  });

  describe('markAllAsRead - read semantics', () => {
    it('should update only unread notifications', async () => {
      const updateChain = createUpdateChain([{ id: 'n1' }, { id: 'n2' }]);
      mockDb.update.mockReturnValue(updateChain);

      const count = await repository.markAllAsRead('user-1');

      expect(count).toBe(2);
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isRead: true,
          readAt: expect.any(Date),
        }),
      );
    });

    it('should return 0 when no unread notifications', async () => {
      const updateChain = createUpdateChain([]);
      mockDb.update.mockReturnValue(updateChain);

      const count = await repository.markAllAsRead('user-1');

      expect(count).toBe(0);
    });

    it('should throw DatabaseException on error', async () => {
      const updateChain = createUpdateChain([], true);
      mockDb.update.mockReturnValue(updateChain);

      await expect(repository.markAllAsRead('user-1')).rejects.toThrow(DatabaseException);
    });
  });
});
