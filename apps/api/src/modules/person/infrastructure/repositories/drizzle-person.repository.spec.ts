import * as schema from '@/database/schema';

import { PersonCreditType } from '../../domain/constants/person.constants';
import {
  type CreditSeed,
  type PersonSeed,
} from '../../domain/repositories/person.repository.interface';
import { type PersonCreditsQuery } from '../queries/person-credits.query';

import { DrizzlePersonRepository } from './drizzle-person.repository';

describe('DrizzlePersonRepository', () => {
  describe('findByTmdbId', () => {
    function dbReturning(rows: unknown[]) {
      const limit = jest.fn().mockResolvedValue(rows);
      const where = jest.fn().mockReturnValue({ limit });
      const from = jest.fn().mockReturnValue({ where });
      const select = jest.fn().mockReturnValue({ from });
      return { select };
    }

    it('maps the row when found', async () => {
      const row = {
        id: 'uuid-1',
        tmdbId: 287,
        slug: 'brad-pitt',
        name: 'Brad Pitt',
        profilePath: '/b.jpg',
        knownForDepartment: 'Acting',
        popularity: 5,
        biography: null,
        birthday: null,
        deathday: null,
        placeOfBirth: null,
        detailsFetchedAt: null,
      };
      const db = dbReturning([row]);
      const repo = new DrizzlePersonRepository(db as never, {} as PersonCreditsQuery);

      const result = await repo.findByTmdbId(287);
      expect(result).toMatchObject({ id: 'uuid-1', tmdbId: 287, name: 'Brad Pitt' });
    });

    it('returns null when not found', async () => {
      const db = dbReturning([]);
      const repo = new DrizzlePersonRepository(db as never, {} as PersonCreditsQuery);
      expect(await repo.findByTmdbId(999)).toBeNull();
    });
  });

  describe('findEligibleCredits', () => {
    it('delegates to PersonCreditsQuery', async () => {
      const execute = jest.fn().mockResolvedValue({ items: [], total: 0 });
      const repo = new DrizzlePersonRepository(
        {} as never,
        { execute } as unknown as PersonCreditsQuery,
      );

      await repo.findEligibleCredits('uuid-1', { limit: 10, offset: 0 });

      expect(execute).toHaveBeenCalledWith('uuid-1', { limit: 10, offset: 0 });
    });
  });

  describe('writeMediaCredits', () => {
    /** Tx mock: insert().values()[.onConflictDoUpdate()], select().from().where(), delete().where() */
    function buildTx(idRows: Array<{ id: string; tmdbId: number }>) {
      const insertedByTable = new Map<unknown, unknown[]>();
      let deleteCalled = false;

      const tx = {
        insert: (table: unknown) => ({
          values: (vals: unknown[]) => {
            insertedByTable.set(table, vals);
            const p: Promise<void> & { onConflictDoUpdate?: () => Promise<void> } =
              Promise.resolve();
            p.onConflictDoUpdate = () => Promise.resolve();
            return p;
          },
        }),
        select: () => ({ from: () => ({ where: () => Promise.resolve(idRows) }) }),
        delete: () => ({
          where: () => {
            deleteCalled = true;
            return Promise.resolve();
          },
        }),
      };

      return { tx, insertedByTable, wasDeleteCalled: () => deleteCalled };
    }

    function makeRepo(idRows: Array<{ id: string; tmdbId: number }>) {
      const ctx = buildTx(idRows);
      const db = { transaction: (cb: (tx: unknown) => Promise<void>) => cb(ctx.tx) };
      const repo = new DrizzlePersonRepository(db as never, {} as PersonCreditsQuery);
      return { repo, ctx };
    }

    const persons: PersonSeed[] = [
      { tmdbId: 1, slug: 'a', name: 'A', profilePath: null, knownForDepartment: null },
      { tmdbId: 2, slug: 'b', name: 'B', profilePath: null, knownForDepartment: null },
    ];

    it('deletes existing credits then inserts rows for resolvable persons', async () => {
      const { repo, ctx } = makeRepo([
        { id: 'p1', tmdbId: 1 },
        { id: 'p2', tmdbId: 2 },
      ]);

      const credits: CreditSeed[] = [
        {
          personTmdbId: 1,
          creditType: PersonCreditType.CAST,
          character: 'X',
          job: null,
          department: null,
          order: 0,
        },
        {
          personTmdbId: 2,
          creditType: PersonCreditType.CREW,
          character: null,
          job: 'Director',
          department: 'Directing',
          order: 0,
        },
      ];

      await repo.writeMediaCredits('media-1', persons, credits);

      expect(ctx.wasDeleteCalled()).toBe(true);
      const inserted = ctx.insertedByTable.get(schema.mediaCredits) as Array<{ personId: string }>;
      expect(inserted).toHaveLength(2);
      expect(inserted.map((r) => r.personId).sort()).toEqual(['p1', 'p2']);
    });

    it('skips credits whose person id could not be resolved', async () => {
      const { repo, ctx } = makeRepo([{ id: 'p1', tmdbId: 1 }]); // tmdbId 2 unresolved

      const credits: CreditSeed[] = [
        {
          personTmdbId: 1,
          creditType: PersonCreditType.CAST,
          character: 'X',
          job: null,
          department: null,
          order: 0,
        },
        {
          personTmdbId: 2,
          creditType: PersonCreditType.CAST,
          character: 'Y',
          job: null,
          department: null,
          order: 1,
        },
      ];

      await repo.writeMediaCredits('media-1', persons, credits);

      const inserted = ctx.insertedByTable.get(schema.mediaCredits) as unknown[];
      expect(inserted).toHaveLength(1);
    });

    it('still clears credits when there are no persons (empty media)', async () => {
      const { repo, ctx } = makeRepo([]);

      await repo.writeMediaCredits('media-1', [], []);

      expect(ctx.wasDeleteCalled()).toBe(true);
      expect(ctx.insertedByTable.get(schema.mediaCredits)).toBeUndefined();
    });
  });
});
