import { PgDialect } from 'drizzle-orm/pg-core';

import { DrizzleUserMediaStateRepository } from './drizzle-user-media-state.repository';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import * as schema from '../../../../database/schema';

describe('DrizzleUserMediaStateRepository', () => {
  const dialect = new PgDialect();
  const render = (chunk: any): string => dialect.sqlToQuery(chunk).sql;

  const posterPath = '/poster.jpg';
  const expectedPoster = ImageMapper.toPoster(posterPath);
  const mockQuery = { execute: jest.fn() } as any;

  const rows = [
    {
      state: {
        id: 's1',
        userId: 'u1',
        mediaItemId: 'm1',
        state: 'watching',
        rating: 80,
        progress: null,
        notes: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      },
      media: {
        id: 'm1',
        type: 'movie',
        title: 'Title',
        slug: 'title',
        posterPath,
        releaseDate: new Date('2020-01-01'),
      },
    },
  ];

  const rowsWithProgress = [
    {
      state: {
        id: 's1',
        userId: 'u1',
        mediaItemId: 'm1',
        state: 'watching',
        rating: null,
        progress: null,
        notes: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      },
      media: {
        id: 'm1',
        type: 'show',
        title: 'Show Title',
        slug: 'show-title',
        posterPath,
        releaseDate: new Date('2020-01-01'),
      },
      progressTotal: 42,
      progressWatched: 5,
      continuePoint: { season: 2, episode: 3 },
    },
  ];

  const makeDbMock = (customRows?: any[]) => {
    const rowsToUse = customRows ?? rows;
    const chain: any = {
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockImplementation((n?: number) => {
        // findOneWithMedia calls limit(1) and awaits the promise
        if (n === 1) {
          return Promise.resolve(rowsToUse);
        }
        // listWithMedia calls .limit(n).offset(m)
        return chain;
      }),
      offset: jest.fn().mockResolvedValue(rowsToUse),
    };

    return {
      select: jest.fn().mockReturnValue(chain),
    };
  };

  it('listWithMedia should map poster via ImageMapper and omit posterPath', async () => {
    const repo = new DrizzleUserMediaStateRepository(makeDbMock() as any, mockQuery);
    (repo as any).mapRow = jest.fn((state) => state);

    const result = await repo.listWithMedia('u1', 10, 0);

    expect(result[0].mediaSummary.poster).toEqual(expectedPoster);
    expect(result[0].mediaSummary).not.toHaveProperty('posterPath');
    expect(result[0].mediaSummary.releaseDate).toEqual(new Date('2020-01-01'));
  });

  it('findOneWithMedia should map poster and return null when not found', async () => {
    const dbMock = makeDbMock();
    const repo = new DrizzleUserMediaStateRepository(dbMock as any, mockQuery);
    (repo as any).mapRow = jest.fn((state) => state);

    const found = await repo.findOneWithMedia('u1', 'm1');
    expect(found?.mediaSummary.poster).toEqual(expectedPoster);
    expect(found?.mediaSummary).not.toHaveProperty('posterPath');

    // Simulate no rows
    (dbMock.select().limit as jest.Mock).mockResolvedValueOnce([]);
    const missing = await repo.findOneWithMedia('u1', 'm1');
    expect(missing).toBeNull();
  });

  it('listWithMedia should respect sort=rating (orderBy has 3 args: rating, createdAt, id)', async () => {
    const dbMock = makeDbMock();
    const repo = new DrizzleUserMediaStateRepository(dbMock as any, mockQuery);
    (repo as any).mapRow = jest.fn((state) => state);

    await repo.listWithMedia('u1', 10, 0, { sort: 'rating' } as any);

    const chain = (dbMock.select as jest.Mock).mock.results[0].value;
    expect(chain.orderBy).toHaveBeenCalled();
    expect(chain.orderBy.mock.calls[0].length).toBe(3);
  });

  it('listWithMedia should respect sort=recent (orderBy has 2 args: createdAt, id)', async () => {
    const dbMock = makeDbMock();
    const repo = new DrizzleUserMediaStateRepository(dbMock as any, mockQuery);
    (repo as any).mapRow = jest.fn((state) => state);

    await repo.listWithMedia('u1', 10, 0, { sort: 'recent' } as any);

    const chain = (dbMock.select as jest.Mock).mock.results[0].value;
    expect(chain.orderBy).toHaveBeenCalled();
    expect(chain.orderBy.mock.calls[0].length).toBe(2);
  });

  it('listWithMedia should accept ratedOnly and states options (smoke)', async () => {
    const dbMock = makeDbMock();
    const repo = new DrizzleUserMediaStateRepository(dbMock as any, mockQuery);
    (repo as any).mapRow = jest.fn((state) => state);

    const result = await repo.listWithMedia('u1', 10, 0, {
      ratedOnly: true,
      states: ['planned'],
      sort: 'releaseDate',
    } as any);

    expect(result).toHaveLength(1);
    const chain = (dbMock.select as jest.Mock).mock.results[0].value;
    expect(chain.where).toHaveBeenCalledTimes(1);
  });

  it('findManyByMediaIds should return empty without querying DB when ids empty', async () => {
    const dbMock = makeDbMock();
    const repo = new DrizzleUserMediaStateRepository(dbMock as any, mockQuery);

    const result = await repo.findManyByMediaIds('u1', []);
    expect(result).toEqual([]);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  describe('findOneWithMedia - continuePoint and progressSummary', () => {
    it('should return continuePoint when show has watched episodes', async () => {
      const dbMock = makeDbMock(rowsWithProgress);
      const repo = new DrizzleUserMediaStateRepository(dbMock as any, mockQuery);
      (repo as any).mapRow = jest.fn((state) => state);

      const result = await repo.findOneWithMedia('u1', 'm1');

      expect(result?.continuePoint).toEqual({ season: 2, episode: 3 });
    });

    it('should return progressSummary when show has episodes', async () => {
      const dbMock = makeDbMock(rowsWithProgress);
      const repo = new DrizzleUserMediaStateRepository(dbMock as any, mockQuery);
      (repo as any).mapRow = jest.fn((state) => state);

      const result = await repo.findOneWithMedia('u1', 'm1');

      expect(result?.progressSummary).toEqual({ watched: 5, total: 42 });
    });

    it('should return null continuePoint when no progress data', async () => {
      const rowsWithNullProgress = [
        {
          ...rowsWithProgress[0],
          continuePoint: null,
        },
      ];
      const dbMock = makeDbMock(rowsWithNullProgress);
      const repo = new DrizzleUserMediaStateRepository(dbMock as any, mockQuery);
      (repo as any).mapRow = jest.fn((state) => state);

      const result = await repo.findOneWithMedia('u1', 'm1');

      expect(result?.continuePoint).toBeNull();
    });

    it('should return null progressSummary for movies', async () => {
      const movieRows = [
        {
          ...rows[0],
          progressTotal: null,
          progressWatched: null,
          continuePoint: null,
        },
      ];
      const dbMock = makeDbMock(movieRows);
      const repo = new DrizzleUserMediaStateRepository(dbMock as any, mockQuery);
      (repo as any).mapRow = jest.fn((state) => state);

      const result = await repo.findOneWithMedia('u1', 'm1');

      expect(result?.progressSummary).toBeNull();
      expect(result?.continuePoint).toBeNull();
    });
  });

  describe('listWithMedia - progressSummary', () => {
    it('should return progressSummary for shows in list', async () => {
      const dbMock = makeDbMock();
      // Override offset to return rows with progress
      const chain = dbMock.select();
      chain.offset = jest.fn().mockResolvedValue(rowsWithProgress);

      const repo = new DrizzleUserMediaStateRepository(dbMock as any, mockQuery);
      (repo as any).mapRow = jest.fn((state) => state);

      const result = await repo.listWithMedia('u1', 10, 0);

      expect(result[0].progressSummary).toEqual({ watched: 5, total: 42 });
    });
  });

  describe('buildListOrderBy', () => {
    const build = (sort: string) =>
      (new DrizzleUserMediaStateRepository(makeDbMock() as any, mockQuery) as any)
        .buildListOrderBy(sort)
        .map(render);

    it('RECENT sort orders by createdAt desc with id as the final tiebreaker', () => {
      const [first, last, ...rest] = build('recent');

      expect(rest).toHaveLength(0);
      expect(first).toBe('"user_media_state"."created_at" desc');
      expect(last).toBe('"user_media_state"."id" desc');
    });

    it('RATING sort puts NULL ratings last, then createdAt, then id', () => {
      const result = build('rating');

      expect(result).toEqual([
        '"user_media_state"."rating" DESC NULLS LAST',
        '"user_media_state"."created_at" desc',
        '"user_media_state"."id" desc',
      ]);
    });

    it('RELEASE_DATE sort puts NULL release dates last, then createdAt, then id', () => {
      const result = build('releaseDate');

      expect(result).toEqual([
        '"media_items"."release_date" DESC NULLS LAST',
        '"user_media_state"."created_at" desc',
        '"user_media_state"."id" desc',
      ]);
    });

    it('never sorts by updatedAt', () => {
      for (const sort of ['recent', 'rating', 'releaseDate']) {
        expect(build(sort).join(' ')).not.toContain('updated_at');
      }
    });
  });

  describe('soft-deleted media filtering', () => {
    const whereSql = (dbMock: any): string => {
      const chain = (dbMock.select as jest.Mock).mock.results[0].value;
      return render(chain.where.mock.calls[0][0]);
    };

    const makeCountDb = () => {
      const chain: any = {
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ count: 3, moviesRated: 0 }]),
      };
      return { select: jest.fn().mockReturnValue(chain), chain };
    };

    it('listWithMedia excludes soft-deleted media', async () => {
      const dbMock = makeDbMock();
      const repo = new DrizzleUserMediaStateRepository(dbMock as any, mockQuery);
      (repo as any).mapRow = jest.fn((state) => state);

      await repo.listWithMedia('u1', 10, 0);

      expect(whereSql(dbMock)).toContain('"media_items"."deleted_at" is null');
    });

    it('countWithMedia uses the same deletedAt filter as listWithMedia', async () => {
      const db = makeCountDb();
      const repo = new DrizzleUserMediaStateRepository(db as any, mockQuery);

      await repo.countWithMedia('u1');

      expect(render(db.chain.where.mock.calls[0][0])).toContain(
        '"media_items"."deleted_at" is null',
      );
    });

    it('countActivityWithMedia and listActivityWithMedia exclude soft-deleted media', async () => {
      const db = makeCountDb();
      const repo = new DrizzleUserMediaStateRepository(db as any, mockQuery);
      await repo.countActivityWithMedia('u1');
      expect(render(db.chain.where.mock.calls[0][0])).toContain(
        '"media_items"."deleted_at" is null',
      );

      const listDb = makeDbMock();
      const listRepo = new DrizzleUserMediaStateRepository(listDb as any, mockQuery);
      (listRepo as any).mapRow = jest.fn((state) => state);
      await listRepo.listActivityWithMedia('u1', 10, 0);
      expect(whereSql(listDb)).toContain('"media_items"."deleted_at" is null');
    });

    it('countContinueWithMedia joins media_items and excludes soft-deleted media', async () => {
      const db = makeCountDb();
      const repo = new DrizzleUserMediaStateRepository(db as any, mockQuery);

      await repo.countContinueWithMedia('u1');

      expect(db.chain.innerJoin).toHaveBeenCalledTimes(1);
      expect(render(db.chain.where.mock.calls[0][0])).toContain(
        '"media_items"."deleted_at" is null',
      );
    });

    it('listContinueWithMedia excludes soft-deleted media', async () => {
      const dbMock = makeDbMock();
      const repo = new DrizzleUserMediaStateRepository(dbMock as any, mockQuery);
      (repo as any).mapRow = jest.fn((state) => state);

      await repo.listContinueWithMedia('u1', 10, 0);

      expect(whereSql(dbMock)).toContain('"media_items"."deleted_at" is null');
    });

    it('getStats excludes soft-deleted media', async () => {
      const db = makeCountDb();
      const repo = new DrizzleUserMediaStateRepository(db as any, mockQuery);

      await repo.getStats('u1');

      expect(render(db.chain.where.mock.calls[0][0])).toContain(
        '"media_items"."deleted_at" is null',
      );
    });
  });

  describe('upsert progress handling', () => {
    const makeUpsertDb = () => {
      const chain: any = {
        values: jest.fn().mockReturnThis(),
        onConflictDoUpdate: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 's1', state: 'completed' }]),
      };
      return { insert: jest.fn().mockReturnValue(chain), chain };
    };

    it('writes progress: null in the conflict SET when progress is explicitly null', async () => {
      const db = makeUpsertDb();
      const repo = new DrizzleUserMediaStateRepository(db as any, mockQuery);
      (repo as any).mapRow = jest.fn((r) => r);

      await repo.upsert({ userId: 'u1', mediaItemId: 'm1', state: 'completed', progress: null });

      const { set } = db.chain.onConflictDoUpdate.mock.calls[0][0];
      expect(set).toHaveProperty('progress', null);
    });

    it('leaves progress out of the conflict SET when it is undefined', async () => {
      const db = makeUpsertDb();
      const repo = new DrizzleUserMediaStateRepository(db as any, mockQuery);
      (repo as any).mapRow = jest.fn((r) => r);

      await repo.upsert({ userId: 'u1', mediaItemId: 'm1', state: 'watching' });

      const { set } = db.chain.onConflictDoUpdate.mock.calls[0][0];
      expect(set).not.toHaveProperty('progress');
    });
  });

  describe('bulkImport', () => {
    const makeBulkDb = (returned: any[]) => {
      const chain: any = {
        values: jest.fn().mockReturnThis(),
        onConflictDoNothing: jest.fn().mockReturnThis(),
        onConflictDoUpdate: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue(returned),
      };
      return { insert: jest.fn().mockReturnValue(chain) };
    };

    it('reports only inserted planned rows (skipped rows are excluded) when not overwriting', async () => {
      // 3 submitted, m2 skipped by ON CONFLICT DO NOTHING (no row returned)
      const db = makeBulkDb([
        { mediaItemId: 'm1', state: 'planned' },
        { mediaItemId: 'm3', state: 'completed' },
      ]);
      const repo = new DrizzleUserMediaStateRepository(db as any, mockQuery);

      const result = await repo.bulkImport(
        'u1',
        [
          { mediaItemId: 'm1', state: 'planned', rating: null },
          { mediaItemId: 'm2', state: 'planned', rating: null },
          { mediaItemId: 'm3', state: 'completed', rating: 80 },
        ],
        false,
      );

      expect(result).toEqual({ imported: 2, skipped: 1, plannedMediaItemIds: ['m1'] });
    });

    it('reports the FINAL state when overwriting (no-downgrade keeps completed)', async () => {
      const db = makeBulkDb([
        { mediaItemId: 'm1', state: 'completed' }, // planned import did not downgrade
        { mediaItemId: 'm2', state: 'planned' },
      ]);
      const repo = new DrizzleUserMediaStateRepository(db as any, mockQuery);

      const result = await repo.bulkImport(
        'u1',
        [
          { mediaItemId: 'm1', state: 'planned', rating: null },
          { mediaItemId: 'm2', state: 'planned', rating: null },
        ],
        true,
      );

      expect(result.plannedMediaItemIds).toEqual(['m2']);
    });
  });

  describe('listFavoriteUpdates', () => {
    it('should delegate to FavoriteUpdatesQuery', async () => {
      const expected = [{ mediaItemId: 'm1', rating: 85 }];
      const queryMock = { execute: jest.fn().mockResolvedValue(expected) };
      const repo = new DrizzleUserMediaStateRepository({} as any, queryMock as any);

      const opts = { ratingThreshold: 60, daysBack: 14, daysAhead: 30, limit: 10 };
      const result = await repo.listFavoriteUpdates('u1', opts);

      expect(queryMock.execute).toHaveBeenCalledWith('u1', opts);
      expect(result).toBe(expected);
    });
  });
});
