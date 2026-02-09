import { FavoriteUpdatesQuery } from './favorite-updates.query';

describe('FavoriteUpdatesQuery', () => {
  const options = {
    ratingThreshold: 60,
    daysBack: 14,
    daysAhead: 30,
    limit: 10,
  };

  const now = new Date();
  const recentAirDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const upcomingAirDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const oldAirDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const farFutureAirDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const makeBaseRow = (
    overrides?: Partial<{ showId: string; mediaItemId: string; rating: number | null }>,
  ) => ({
    mediaItemId: overrides?.mediaItemId ?? 'm1',
    rating: overrides?.rating ?? 85,
    showId: overrides?.showId ?? 'show1',
    media: {
      id: overrides?.mediaItemId ?? 'm1',
      type: 'show',
      title: 'Test Show',
      slug: 'test-show',
      posterPath: '/poster.jpg',
      releaseDate: new Date('2020-01-01'),
    },
  });

  const makeEpisode = (
    overrides?: Partial<{
      showId: string;
      seasonNumber: number;
      episodeNumber: number;
      title: string | null;
      airDate: Date | null;
    }>,
  ) => ({
    showId: overrides?.showId ?? 'show1',
    seasonNumber: overrides?.seasonNumber ?? 1,
    episodeNumber: overrides?.episodeNumber ?? 5,
    title: overrides?.title ?? 'Episode Title',
    airDate: overrides?.airDate ?? recentAirDate,
  });

  /**
   * Creates a mock db that tracks sequential calls.
   *
   * Step 1 (baseRows): select -> ... -> limit (terminal)
   * Step 2a (latest):  selectDistinctOn -> ... -> orderBy (terminal)
   * Step 2b (next):    selectDistinctOn -> ... -> orderBy (terminal)
   * Step 3 (batch):    select -> ... -> groupBy (terminal)
   */
  const makeDbMock = (config: {
    baseRows: any[];
    latestEpisodes: any[];
    nextEpisodes: any[];
    batchCounts: any[];
  }) => {
    let selectCallIndex = 0;
    let selectDistinctOnCallIndex = 0;

    const makeOrderByTerminalChain = (resolvedValue: any) => ({
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockResolvedValue(resolvedValue),
    });

    const makeLimitTerminalChain = (resolvedValue: any) => {
      const chain: any = {
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(resolvedValue),
      };
      return chain;
    };

    const makeGroupByTerminalChain = (resolvedValue: any) => ({
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockResolvedValue(resolvedValue),
    });

    return {
      select: jest.fn().mockImplementation(() => {
        const idx = selectCallIndex++;
        if (idx === 0) return makeLimitTerminalChain(config.baseRows);
        return makeGroupByTerminalChain(config.batchCounts);
      }),
      selectDistinctOn: jest.fn().mockImplementation(() => {
        const idx = selectDistinctOnCallIndex++;
        if (idx === 0) return makeOrderByTerminalChain(config.latestEpisodes);
        return makeOrderByTerminalChain(config.nextEpisodes);
      }),
    };
  };

  const createQuery = (dbMock: any) => {
    const query = new FavoriteUpdatesQuery(dbMock as any);
    (query as any).logger = { error: jest.fn() };
    return query;
  };

  it('should return items with correct structure', async () => {
    const dbMock = makeDbMock({
      baseRows: [makeBaseRow()],
      latestEpisodes: [makeEpisode({ airDate: recentAirDate })],
      nextEpisodes: [makeEpisode({ airDate: upcomingAirDate, episodeNumber: 6 })],
      batchCounts: [{ showId: 'show1', count: 1 }],
    });
    const query = createQuery(dbMock);

    const result = await query.execute('u1', options);

    expect(result).toHaveLength(1);
    const item = result[0];
    expect(item.mediaItemId).toBe('m1');
    expect(item.rating).toBe(85);
    expect(item.mediaSummary).toBeDefined();
    expect(item.mediaSummary).not.toHaveProperty('posterPath');
    expect(item.latestEpisode).toEqual({
      seasonNumber: 1,
      episodeNumber: 5,
      title: 'Episode Title',
      airDate: recentAirDate,
      isBatchRelease: false,
    });
    expect(item.nextEpisode).toEqual({
      seasonNumber: 1,
      episodeNumber: 6,
      title: 'Episode Title',
      airDate: upcomingAirDate,
      isBatchRelease: false,
    });
  });

  it('should set isBatchRelease true on latestEpisode when batch count >= 3', async () => {
    const dbMock = makeDbMock({
      baseRows: [makeBaseRow()],
      latestEpisodes: [makeEpisode({ airDate: recentAirDate })],
      nextEpisodes: [],
      batchCounts: [{ showId: 'show1', count: 10 }],
    });
    const query = createQuery(dbMock);

    const result = await query.execute('u1', options);

    expect(result).toHaveLength(1);
    expect(result[0].latestEpisode?.isBatchRelease).toBe(true);
  });

  it('should set isBatchRelease false on latestEpisode when batch count < 3', async () => {
    const dbMock = makeDbMock({
      baseRows: [makeBaseRow()],
      latestEpisodes: [makeEpisode({ airDate: recentAirDate })],
      nextEpisodes: [],
      batchCounts: [{ showId: 'show1', count: 2 }],
    });
    const query = createQuery(dbMock);

    const result = await query.execute('u1', options);

    expect(result).toHaveLength(1);
    expect(result[0].latestEpisode?.isBatchRelease).toBe(false);
  });

  it('should always set isBatchRelease false on nextEpisode even when batch detected', async () => {
    const dbMock = makeDbMock({
      baseRows: [makeBaseRow()],
      latestEpisodes: [makeEpisode({ airDate: recentAirDate })],
      nextEpisodes: [makeEpisode({ airDate: upcomingAirDate, episodeNumber: 6 })],
      batchCounts: [{ showId: 'show1', count: 10 }],
    });
    const query = createQuery(dbMock);

    const result = await query.execute('u1', options);

    expect(result).toHaveLength(1);
    expect(result[0].latestEpisode?.isBatchRelease).toBe(true);
    expect(result[0].nextEpisode?.isBatchRelease).toBe(false);
  });

  it('should return empty array when no base rows and skip further queries', async () => {
    const dbMock = makeDbMock({
      baseRows: [],
      latestEpisodes: [],
      nextEpisodes: [],
      batchCounts: [],
    });
    const query = createQuery(dbMock);

    const result = await query.execute('u1', options);

    expect(result).toEqual([]);
    expect(dbMock.selectDistinctOn).not.toHaveBeenCalled();
    expect(dbMock.select).toHaveBeenCalledTimes(1);
  });

  it('should skip shows when episodes are outside the date range', async () => {
    const dbMock = makeDbMock({
      baseRows: [makeBaseRow()],
      latestEpisodes: [makeEpisode({ airDate: oldAirDate })],
      nextEpisodes: [makeEpisode({ airDate: farFutureAirDate, episodeNumber: 6 })],
      batchCounts: [{ showId: 'show1', count: 1 }],
    });
    const query = createQuery(dbMock);

    const result = await query.execute('u1', options);

    expect(result).toEqual([]);
  });

  it('should skip batch query when no latestEpisodes have airDates', async () => {
    const dbMock = makeDbMock({
      baseRows: [makeBaseRow()],
      latestEpisodes: [],
      nextEpisodes: [makeEpisode({ airDate: upcomingAirDate })],
      batchCounts: [],
    });
    const query = createQuery(dbMock);

    const result = await query.execute('u1', options);

    expect(result).toHaveLength(1);
    expect(dbMock.select).toHaveBeenCalledTimes(1);
  });

  it('should throw DatabaseException on query failure', async () => {
    const dbMock = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            innerJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                orderBy: jest.fn().mockReturnValue({
                  limit: jest.fn().mockRejectedValue(new Error('connection lost')),
                }),
              }),
            }),
          }),
        }),
      }),
    };
    const query = createQuery(dbMock);

    await expect(query.execute('u1', options)).rejects.toThrow('Failed to list favorite updates');
  });
});
