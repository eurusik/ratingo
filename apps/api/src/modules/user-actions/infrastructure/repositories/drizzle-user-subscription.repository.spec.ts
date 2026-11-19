import { Test } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
import { DrizzleUserSubscriptionRepository } from './drizzle-user-subscription.repository';
import { AutoPlanSubscriptionsQuery } from '../queries/auto-plan-subscriptions.query';
import { ClaimMovieReleasesQuery } from '../queries/claim-movie-releases.query';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { DatabaseException } from '@/common/exceptions/database.exception';
import { SUBSCRIPTION_TRIGGER } from '@/modules/user-actions/domain/entities/user-subscription.entity';

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
        ClaimMovieReleasesQuery,
        AutoPlanSubscriptionsQuery,
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

    it('only matches ACTIVE rows so re-deactivating reports false (no duplicate UNSUBSCRIBE log)', async () => {
      const module = await setup({ resolveUpdate: [] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      await repository.deactivate('user-id-1', 'media-id-1', SUBSCRIPTION_TRIGGER.RELEASE);

      const where = db.update.mock.results[0].value.where.mock.calls[0][0];
      const { sql, params } = new PgDialect().sqlToQuery(where);
      expect(sql).toContain('"user_subscriptions"."is_active" = $');
      expect(params).toContain(true);
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

    it('excludes soft-deleted media, consistently with countActive', async () => {
      const module = await setup({ resolveSelect: [] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      await repository.listActiveWithMedia('user-id-1');
      await repository.countActive('user-id-1');

      const wheres = db.select.mock.results[0].value.where.mock.calls.map(
        (c: any[]) => new PgDialect().sqlToQuery(c[0]).sql,
      );
      expect(wheres).toHaveLength(2);
      for (const w of wheres) {
        expect(w).toContain('"media_items"."deleted_at" is null');
      }
      // countActive must join media_items like the list does
      expect(db.select.mock.results[0].value.innerJoin).toHaveBeenCalledTimes(2);
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

    it('should throw DatabaseException on error', async () => {
      const module = await setup({ reject: new Error('DB error') });
      repository = module.get(DrizzleUserSubscriptionRepository);

      await expect(repository.findTrackedShowTmdbIds()).rejects.toThrow(DatabaseException);
    });
  });

  describe('claimMovieReleases', () => {
    const window = {
      from: new Date('2026-11-16T00:00:00Z'),
      toExclusive: new Date('2026-11-20T00:00:00Z'),
    };

    const claimedWhere = () => {
      const where = db.update.mock.results[0].value.where.mock.calls[0][0];
      return new PgDialect().sqlToQuery(where);
    };

    it('claims only active, never-notified subscriptions whose date is inside the window', async () => {
      const module = await setup({ resolveUpdate: [] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      await repository.claimMovieReleases(SUBSCRIPTION_TRIGGER.ON_STREAMING, window);

      const { sql, params } = claimedWhere();
      expect(sql).toContain('"user_subscriptions"."last_notified_at" is null');
      expect(sql).toContain('"movies"."digital_release_date" >= $');
      expect(sql).toContain('"movies"."digital_release_date" < $');
      expect(params).toEqual(
        expect.arrayContaining([
          SUBSCRIPTION_TRIGGER.ON_STREAMING,
          window.from.toISOString(),
          window.toExclusive.toISOString(),
        ]),
      );
    });

    it('skips subscriptions created after the movie was already out', async () => {
      const module = await setup({ resolveUpdate: [] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      await repository.claimMovieReleases(SUBSCRIPTION_TRIGGER.ON_STREAMING, window);

      expect(claimedWhere().sql).toContain(
        `"user_subscriptions"."created_at" < "movies"."digital_release_date" + interval '1 day'`,
      );
    });

    it('uses the effective release date for release and skips movies whose digital release is notified in the same window', async () => {
      const module = await setup({ resolveUpdate: [] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      await repository.claimMovieReleases(SUBSCRIPTION_TRIGGER.RELEASE, window);

      const { sql } = claimedWhere();
      expect(sql).toContain(
        'coalesce("movies"."theatrical_release_date", "movies"."digital_release_date", "media_items"."release_date") >= $',
      );
      expect(sql).toContain('not (("movies"."digital_release_date" >= $');
      expect(sql).toContain('exists (select 1 from "user_subscriptions" "other_subs" where');
      expect(sql).toContain('"other_subs"."user_id" = "user_subscriptions"."user_id"');
    });

    it('returns each claimed subscription with its release notice', async () => {
      const row = {
        id: 'sub-id-1',
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        theatricalReleaseDate: new Date('2026-11-18T00:00:00Z'),
        digitalReleaseDate: null,
        releaseDate: null,
        releases: [{ country: 'US', type: 3, date: '2026-11-18T00:00:00.000Z' }],
      };
      const module = await setup({ resolveUpdate: [row] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      await expect(
        repository.claimMovieReleases(SUBSCRIPTION_TRIGGER.RELEASE, window),
      ).resolves.toEqual([
        {
          id: 'sub-id-1',
          userId: 'user-id-1',
          mediaItemId: 'media-id-1',
          release: { releasedOn: row.theatricalReleaseDate, kind: 'theatrical', country: 'US' },
        },
      ]);
    });

    it('hands back a claim it cannot describe instead of keeping it silently', async () => {
      const row = {
        id: 'sub-id-1',
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        theatricalReleaseDate: null,
        digitalReleaseDate: null,
        releaseDate: null,
        releases: null,
      };
      const module = await setup({ resolveUpdate: [row] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      await expect(
        repository.claimMovieReleases(SUBSCRIPTION_TRIGGER.ON_STREAMING, window),
      ).resolves.toEqual([]);

      const handBack = db.update.mock.results[1].value;
      expect(handBack.set).toHaveBeenCalledWith(expect.objectContaining({ lastNotifiedAt: null }));
    });
  });

  describe('auto plan subscriptions', () => {
    const renderWhere = () =>
      new PgDialect().sqlToQuery(db.select.mock.results[0]?.value.where.mock.calls[0][0]).sql;

    it('treats active rows and rows the user switched off as closed to auto plan', async () => {
      const module = await setup({
        resolveSelect: [{ trigger: 'release' }, { trigger: 'on_streaming' }],
      });
      repository = module.get(DrizzleUserSubscriptionRepository);

      const triggers = await repository.findTriggersClosedToAutoPlan('user-id-1', 'media-id-1');

      expect(triggers).toEqual(['release', 'on_streaming']);
      expect(renderWhere()).toMatch(/"is_active" or not "user_subscriptions"\."auto_plan"/);
    });

    it('switches off only automatic rows of a movie that is no longer planned', async () => {
      const module = await setup({ resolveUpdate: [{ trigger: 'on_streaming' }] });
      repository = module.get(DrizzleUserSubscriptionRepository);

      const triggers = await repository.deactivateAbandonedAutoPlan('user-id-1', 'media-id-1');

      expect(triggers).toEqual(['on_streaming']);
      const where = new PgDialect().sqlToQuery(
        db.update.mock.results[0].value.where.mock.calls[0][0],
      );
      expect(where.sql).toContain('"user_subscriptions"."auto_plan"');
      expect(where.sql).toContain('not (');
      expect(where.sql).toContain('"user_saved_items"');
      expect(where.sql).toContain('"user_media_state"');
      expect(where.params).toEqual(
        expect.arrayContaining(['user-id-1', 'media-id-1', 'for_later', 'planned']),
      );
    });
  });
});
