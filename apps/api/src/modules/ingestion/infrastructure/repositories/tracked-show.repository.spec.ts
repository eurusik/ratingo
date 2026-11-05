import { DatabaseException } from '../../../../common/exceptions/database.exception';

import { TrackedShowRepository } from './tracked-show.repository';

const chainResolving = (result: Promise<unknown>) => {
  const chain: Record<string, jest.Mock> = {};
  for (const method of ['from', 'innerJoin', 'where', 'orderBy']) {
    chain[method] = jest.fn().mockReturnValue(chain);
  }
  chain.limit = jest.fn().mockReturnValue(result);
  return { select: jest.fn().mockReturnValue(chain) };
};

describe('TrackedShowRepository', () => {
  it('returns the first show status row', async () => {
    const row = { mediaItemId: 'm1', status: 'Returning Series' };
    const repository = new TrackedShowRepository(chainResolving(Promise.resolve([row])) as never);

    await expect(repository.findShowStatus(1)).resolves.toEqual(row);
  });

  it('returns null when the show is not found', async () => {
    const repository = new TrackedShowRepository(chainResolving(Promise.resolve([])) as never);

    await expect(repository.findShowCore(1)).resolves.toBeNull();
  });

  it('returns the latest aired episode', async () => {
    const row = { seasonNumber: 2, episodeNumber: 5, airDate: new Date('2026-01-01') };
    const repository = new TrackedShowRepository(chainResolving(Promise.resolve([row])) as never);

    await expect(repository.findLastAiredEpisode(1)).resolves.toEqual(row);
  });

  it('wraps database failures in DatabaseException', async () => {
    const repository = new TrackedShowRepository(
      chainResolving(Promise.reject(new Error('connection lost'))) as never,
    );

    await expect(repository.findShowStatus(1)).rejects.toBeInstanceOf(DatabaseException);
  });
});
