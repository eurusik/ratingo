import { PgDialect } from 'drizzle-orm/pg-core';
import { MediaSearchQuery } from './media-search.query';
import { createDrizzleThenable } from '../__test__/drizzle-mock.utils';

describe('MediaSearchQuery', () => {
  let db: any;

  const createQuery = (options: { resolveSelect?: unknown; reject?: Error } = {}) => {
    const selectChain = createDrizzleThenable(options.resolveSelect ?? [], options.reject);
    db = { select: jest.fn().mockReturnValue(selectChain) };
    return new MediaSearchQuery(db);
  };

  describe('execute', () => {
    it('should return results matching the query', async () => {
      const query = createQuery({ resolveSelect: [{ id: 'm1' }] });

      const result = await query.execute('test query', 10);
      expect(result).toEqual([{ id: 'm1' }]);
      expect(db.select).toHaveBeenCalled();
    });

    it('should call db.select twice: once for outer query and once for EXISTS subquery', async () => {
      // The EXISTS subquery is built via this.db.select({ one: sql`1` }) nested inside
      // the outer query's where clause. This means db.select is called twice per search call.
      // Previously the method used innerJoin, which would only call db.select once.
      const query = createQuery({ resolveSelect: [{ id: 'm1' }] });

      await query.execute('test', 10);

      // db.select called twice: outer query + EXISTS subquery construction
      expect(db.select).toHaveBeenCalledTimes(2);
    });

    it('should escape LIKE wildcards and backslashes in the ILIKE pattern', async () => {
      const query = createQuery({ resolveSelect: [] });

      await query.execute('100%_a\\b', 10);

      // select chain is shared with the EXISTS subquery, whose where() is called first
      const selectChain = db.select.mock.results[0].value;
      const whereCalls = selectChain.where.mock.calls;
      const { params } = new PgDialect().sqlToQuery(whereCalls[whereCalls.length - 1][0]);
      // ILIKE pattern is escaped; the raw term (used by trigram %) stays unescaped
      expect(params).toContain('%100\\%\\_a\\\\b%');
      expect(params).toContain('100%_a\\b');
    });

    it('should not call innerJoin (EXISTS subquery replaces JOIN to avoid row multiplication)', async () => {
      const query = createQuery({ resolveSelect: [{ id: 'm1' }] });

      await query.execute('test', 10);

      // The Drizzle chain mock tracks all method calls on the thenable.
      // innerJoin must not be called — it was removed in favour of EXISTS.
      const selectChain = db.select.mock.results[0].value;
      expect(selectChain.innerJoin).not.toHaveBeenCalled();
    });

    it('should return empty array and not throw when a DB error occurs', async () => {
      const query = createQuery({ reject: new Error('DB Error') });

      const result = await query.execute('bad', 5);
      expect(result).toEqual([]);
    });

    it('should return empty array for a query that matches nothing', async () => {
      const query = createQuery({ resolveSelect: [] });

      const result = await query.execute('zzznomatch', 10);
      expect(result).toEqual([]);
    });

    it('should respect the limit parameter', async () => {
      const rows = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}` }));
      const query = createQuery({ resolveSelect: rows });

      const result = await query.execute('popular', 5);
      // The query delegates limit enforcement to the DB; we assert the
      // resolved rows are returned as-is without further slicing.
      expect(result).toHaveLength(5);

      // Verify .limit() was called with the correct parameter
      const selectChain = db.select.mock.results[0].value;
      expect(selectChain.limit).toHaveBeenCalledWith(5);
    });
  });
});
