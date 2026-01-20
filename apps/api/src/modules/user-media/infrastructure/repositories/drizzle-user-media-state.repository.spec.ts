import { DrizzleUserMediaStateRepository } from './drizzle-user-media-state.repository';
import { ImageMapper } from '../../../../common/mappers/image.mapper';

describe('DrizzleUserMediaStateRepository', () => {
  const posterPath = '/poster.jpg';
  const expectedPoster = ImageMapper.toPoster(posterPath);

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
    const repo = new DrizzleUserMediaStateRepository(makeDbMock() as any);
    (repo as any).mapRow = jest.fn((state) => state);

    const result = await repo.listWithMedia('u1', 10, 0);

    expect(result[0].mediaSummary.poster).toEqual(expectedPoster);
    expect(result[0].mediaSummary).not.toHaveProperty('posterPath');
    expect(result[0].mediaSummary.releaseDate).toEqual(new Date('2020-01-01'));
  });

  it('findOneWithMedia should map poster and return null when not found', async () => {
    const dbMock = makeDbMock();
    const repo = new DrizzleUserMediaStateRepository(dbMock as any);
    (repo as any).mapRow = jest.fn((state) => state);

    const found = await repo.findOneWithMedia('u1', 'm1');
    expect(found?.mediaSummary.poster).toEqual(expectedPoster);
    expect(found?.mediaSummary).not.toHaveProperty('posterPath');

    // Simulate no rows
    (dbMock.select().limit as jest.Mock).mockResolvedValueOnce([]);
    const missing = await repo.findOneWithMedia('u1', 'm1');
    expect(missing).toBeNull();
  });

  it('listWithMedia should respect sort=rating (orderBy has 2 args)', async () => {
    const dbMock = makeDbMock();
    const repo = new DrizzleUserMediaStateRepository(dbMock as any);
    (repo as any).mapRow = jest.fn((state) => state);

    await repo.listWithMedia('u1', 10, 0, { sort: 'rating' } as any);

    const chain = (dbMock.select as jest.Mock).mock.results[0].value;
    expect(chain.orderBy).toHaveBeenCalled();
    expect(chain.orderBy.mock.calls[0].length).toBe(2);
  });

  it('listWithMedia should respect sort=recent (orderBy has 1 arg)', async () => {
    const dbMock = makeDbMock();
    const repo = new DrizzleUserMediaStateRepository(dbMock as any);
    (repo as any).mapRow = jest.fn((state) => state);

    await repo.listWithMedia('u1', 10, 0, { sort: 'recent' } as any);

    const chain = (dbMock.select as jest.Mock).mock.results[0].value;
    expect(chain.orderBy).toHaveBeenCalled();
    expect(chain.orderBy.mock.calls[0].length).toBe(1);
  });

  it('listWithMedia should accept ratedOnly and states options (smoke)', async () => {
    const dbMock = makeDbMock();
    const repo = new DrizzleUserMediaStateRepository(dbMock as any);
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
    const repo = new DrizzleUserMediaStateRepository(dbMock as any);

    const result = await repo.findManyByMediaIds('u1', []);
    expect(result).toEqual([]);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  describe('findOneWithMedia - continuePoint and progressSummary', () => {
    it('should return continuePoint when show has watched episodes', async () => {
      const dbMock = makeDbMock(rowsWithProgress);
      const repo = new DrizzleUserMediaStateRepository(dbMock as any);
      (repo as any).mapRow = jest.fn((state) => state);

      const result = await repo.findOneWithMedia('u1', 'm1');

      expect(result?.continuePoint).toEqual({ season: 2, episode: 3 });
    });

    it('should return progressSummary when show has episodes', async () => {
      const dbMock = makeDbMock(rowsWithProgress);
      const repo = new DrizzleUserMediaStateRepository(dbMock as any);
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
      const repo = new DrizzleUserMediaStateRepository(dbMock as any);
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
      const repo = new DrizzleUserMediaStateRepository(dbMock as any);
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

      const repo = new DrizzleUserMediaStateRepository(dbMock as any);
      (repo as any).mapRow = jest.fn((state) => state);

      const result = await repo.listWithMedia('u1', 10, 0);

      expect(result[0].progressSummary).toEqual({ watched: 5, total: 42 });
    });
  });
});
