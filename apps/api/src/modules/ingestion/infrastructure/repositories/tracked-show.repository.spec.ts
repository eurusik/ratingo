import { type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { DatabaseException } from '@/common/exceptions/database.exception';

import { TrackedShowRepository } from './tracked-show.repository';

const buildDb = (rows: unknown[] | Error) => {
  const chain: Record<string, jest.Mock> = {};
  for (const method of ['from', 'innerJoin', 'where', 'orderBy']) {
    chain[method] = jest.fn().mockReturnValue(chain);
  }
  chain.limit = jest
    .fn()
    .mockReturnValue(rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows));
  return { db: { select: jest.fn().mockReturnValue(chain) }, chain };
};

describe('TrackedShowRepository', () => {
  describe('findByTmdbId', () => {
    it('returns the tracked show', async () => {
      const show = {
        mediaItemId: 'm1',
        status: 'Returning Series',
        totalSeasons: 2,
        nextAirDate: null,
      };
      const { db } = buildDb([show]);

      await expect(new TrackedShowRepository(db as never).findByTmdbId(1)).resolves.toEqual(show);
    });

    it('returns null when the show is not found', async () => {
      const { db } = buildDb([]);

      await expect(new TrackedShowRepository(db as never).findByTmdbId(1)).resolves.toBeNull();
    });

    it('wraps database failures in DatabaseException', async () => {
      const { db } = buildDb(new Error('connection lost'));

      await expect(new TrackedShowRepository(db as never).findByTmdbId(1)).rejects.toBeInstanceOf(
        DatabaseException,
      );
    });
  });

  describe('findLatestEpisodeAiredBy', () => {
    it('limits episodes to those aired by the given time', async () => {
      const episode = { seasonNumber: 2, episodeNumber: 5, airDate: new Date('2026-01-01') };
      const airedBy = new Date('2026-03-01T00:00:00.000Z');
      const { db, chain } = buildDb([episode]);

      const result = await new TrackedShowRepository(db as never).findLatestEpisodeAiredBy(
        7,
        airedBy,
      );

      expect(result).toEqual(episode);
      const { sql, params } = new PgDialect().sqlToQuery(chain.where.mock.calls[0][0] as SQL);
      expect(sql).toContain('"air_date" <= $');
      expect(params).toEqual(expect.arrayContaining([7, airedBy.toISOString()]));
    });

    it('returns null when no episode has aired', async () => {
      const { db } = buildDb([]);

      await expect(
        new TrackedShowRepository(db as never).findLatestEpisodeAiredBy(7, new Date()),
      ).resolves.toBeNull();
    });
  });
});
