import { Test, TestingModule } from '@nestjs/testing';
import { DrizzleUserSubscriptionRepository } from './drizzle-user-subscription.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { SUBSCRIPTION_TRIGGER } from '../../domain/entities/user-subscription.entity';

const createThenable = (resolveWith: any = [], rejectWith?: Error) => {
  const thenable: any = {};
  const chainMethods = [
    'select',
    'selectDistinct',
    'from',
    'where',
    'limit',
    'offset',
    'orderBy',
    'insert',
    'values',
    'returning',
    'onConflictDoUpdate',
    'update',
    'set',
    'innerJoin',
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

describe('DrizzleUserSubscriptionRepository', () => {
  let repository: DrizzleUserSubscriptionRepository;
  let db: any;

  const mockSubscriptionRow = {
    id: 'sub-id-1',
    userId: 'user-id-1',
    mediaItemId: 'media-id-1',
    trigger: 'release',
    channel: 'push',
    isActive: true,
    lastNotifiedAt: null,
    lastNotifiedEpisodeKey: null,
    lastNotifiedSeasonNumber: null,
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
      resolveUpdate?: any;
      reject?: Error;
    } = {},
  ) => {
    const selectChain = createThenable(options.resolveSelect ?? [], options.reject);
    const insertChain = createThenable(
      options.resolveInsert ?? [mockSubscriptionRow],
      options.reject,
    );
    const updateChain = createThenable(
      options.resolveUpdate ?? [{ id: 'sub-id-1' }],
      options.reject,
    );

    db = {
      select: jest.fn().mockReturnValue(selectChain),
      selectDistinct: jest.fn().mockReturnValue(selectChain),
      insert: jest.fn().mockReturnValue(insertChain),
      update: jest.fn().mockReturnValue(updateChain),
    };

    return Test.createTestingModule({
      providers: [
        DrizzleUserSubscriptionRepository,
        { provide: DATABASE_CONNECTION, useValue: db },
      ],
    }).compile();
  };

  describe('upsert', () => {
    it('should upsert a subscription and return mapped entity', async () => {
      const module = await setup({ resolveInsert: [mockSubscriptionRow] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      const result = await repository.upsert({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.RELEASE,
      });

      expect(result).toEqual({
        id: 'sub-id-1',
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: 'release',
        channel: 'push',
        isActive: true,
        lastNotifiedAt: null,
        lastNotifiedEpisodeKey: null,
        lastNotifiedSeasonNumber: null,
        createdAt: mockSubscriptionRow.createdAt,
        updatedAt: mockSubscriptionRow.updatedAt,
      });
      expect(db.insert).toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB error') });
      repository = module.get(DrizzleUserSubscriptionRepository);

      await expect(
        repository.upsert({
          userId: 'user-id-1',
          mediaItemId: 'media-id-1',
          trigger: SUBSCRIPTION_TRIGGER.RELEASE,
        }),
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe('deactivate', () => {
    it('should return true when subscription is deactivated', async () => {
      const module = await setup({ resolveUpdate: [{ id: 'sub-id-1' }] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      const result = await repository.deactivate(
        'user-id-1',
        'media-id-1',
        SUBSCRIPTION_TRIGGER.RELEASE,
      );

      expect(result).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });

    it('should return false when no subscription deactivated', async () => {
      const module = await setup({ resolveUpdate: [] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      const result = await repository.deactivate(
        'user-id-1',
        'media-id-1',
        SUBSCRIPTION_TRIGGER.RELEASE,
      );

      expect(result).toBe(false);
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB error') });
      repository = module.get(DrizzleUserSubscriptionRepository);

      await expect(
        repository.deactivate('user-id-1', 'media-id-1', SUBSCRIPTION_TRIGGER.RELEASE),
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe('findOne', () => {
    it('should return subscription when found', async () => {
      const module = await setup({ resolveSelect: [mockSubscriptionRow] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      const result = await repository.findOne(
        'user-id-1',
        'media-id-1',
        SUBSCRIPTION_TRIGGER.RELEASE,
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe('sub-id-1');
      expect(result?.trigger).toBe('release');
    });

    it('should return null when not found', async () => {
      const module = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      const result = await repository.findOne(
        'user-id-1',
        'media-id-1',
        SUBSCRIPTION_TRIGGER.RELEASE,
      );

      expect(result).toBeNull();
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB error') });
      repository = module.get(DrizzleUserSubscriptionRepository);

      await expect(
        repository.findOne('user-id-1', 'media-id-1', SUBSCRIPTION_TRIGGER.RELEASE),
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe('findActiveTriggersForMedia', () => {
    it('should return active triggers for media', async () => {
      const module = await setup({
        resolveSelect: [{ trigger: 'release' }, { trigger: 'new_season' }],
      });
      repository = module.get(DrizzleUserSubscriptionRepository);

      const result = await repository.findActiveTriggersForMedia('user-id-1', 'media-id-1');

      expect(result).toEqual(['release', 'new_season']);
    });

    it('should return empty array when no active subscriptions', async () => {
      const module = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      const result = await repository.findActiveTriggersForMedia('user-id-1', 'media-id-1');

      expect(result).toEqual([]);
    });
  });

  describe('listActiveWithMedia', () => {
    it('should return subscriptions with media summary', async () => {
      const module = await setup({
        resolveSelect: [{ sub: mockSubscriptionRow, media: mockMediaRow }],
      });
      repository = module.get(DrizzleUserSubscriptionRepository);

      const result = await repository.listActiveWithMedia('user-id-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sub-id-1');
      expect(result[0].mediaSummary).toBeDefined();
      expect(result[0].mediaSummary.title).toBe('Inception');
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB error') });
      repository = module.get(DrizzleUserSubscriptionRepository);

      await expect(repository.listActiveWithMedia('user-id-1')).rejects.toThrow(DatabaseException);
    });
  });

  describe('countActive', () => {
    it('should return count of active subscriptions', async () => {
      const module = await setup({ resolveSelect: [{ count: 3 }] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      const result = await repository.countActive('user-id-1');

      expect(result).toBe(3);
    });

    it('should return 0 when no active subscriptions', async () => {
      const module = await setup({ resolveSelect: [{ count: 0 }] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      const result = await repository.countActive('user-id-1');

      expect(result).toBe(0);
    });
  });

  describe('markNotified', () => {
    it('should update lastNotifiedAt', async () => {
      const module = await setup({ resolveUpdate: [] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      await repository.markNotified('sub-id-1');

      expect(db.update).toHaveBeenCalled();
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB error') });
      repository = module.get(DrizzleUserSubscriptionRepository);

      await expect(repository.markNotified('sub-id-1')).rejects.toThrow(DatabaseException);
    });
  });

  describe('findTrackedShowTmdbIds', () => {
    it('should return array of tmdbIds for tracked shows', async () => {
      const module = await setup({
        resolveSelect: [{ tmdbId: 12345 }, { tmdbId: 67890 }],
      });
      repository = module.get(DrizzleUserSubscriptionRepository);

      const result = await repository.findTrackedShowTmdbIds();

      expect(result).toEqual([12345, 67890]);
      expect(db.selectDistinct).toHaveBeenCalled();
    });

    it('should return empty array when no tracked shows', async () => {
      const module = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      const result = await repository.findTrackedShowTmdbIds();

      expect(result).toEqual([]);
    });

    it('should filter out null tmdbIds', async () => {
      const module = await setup({
        resolveSelect: [{ tmdbId: 12345 }, { tmdbId: null }, { tmdbId: 67890 }],
      });
      repository = module.get(DrizzleUserSubscriptionRepository);

      const result = await repository.findTrackedShowTmdbIds();

      expect(result).toEqual([12345, 67890]);
    });

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB error') });
      repository = module.get(DrizzleUserSubscriptionRepository);

      await expect(repository.findTrackedShowTmdbIds()).rejects.toThrow(DatabaseException);
    });
  });
});
