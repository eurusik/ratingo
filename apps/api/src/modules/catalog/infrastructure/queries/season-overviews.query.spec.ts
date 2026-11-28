import { drizzle } from 'drizzle-orm/postgres-js';

import { DatabaseException } from '@/common/exceptions/database.exception';
import * as schema from '@/database/schema';

import { SeasonOverviewsQuery } from './season-overviews.query';

describe('SeasonOverviewsQuery', () => {
  const query = new SeasonOverviewsQuery(drizzle.mock({ schema }));

  afterEach(() => jest.restoreAllMocks());

  it('reads one season of a ready, not deleted show by slug, in episode order', () => {
    const { sql, params } = query.select('shetland', 2).toSQL();

    expect(sql).toContain('"seasons"."number" = $1');
    expect(sql).toContain('"media_items"."slug" = $2');
    expect(sql).toContain('"media_items"."ingestion_status" = $3');
    expect(sql).toContain('"media_items"."deleted_at" is null');
    expect(sql).toMatch(/order by "episodes"\."number" asc, "episodes"\."id" asc$/);
    expect(params).toEqual([2, 'shetland', 'ready']);
  });

  it('returns the selected rows', async () => {
    const rows = [{ number: 1, overview: 'Шторм' }];
    jest.spyOn(query, 'select').mockReturnValue(Promise.resolve(rows) as never);

    await expect(query.execute('shetland', 1)).resolves.toEqual(rows);
  });

  it('wraps database failures', async () => {
    jest.spyOn(query, 'select').mockReturnValue(Promise.reject(new Error('down')) as never);

    await expect(query.execute('shetland', 1)).rejects.toBeInstanceOf(DatabaseException);
  });
});
