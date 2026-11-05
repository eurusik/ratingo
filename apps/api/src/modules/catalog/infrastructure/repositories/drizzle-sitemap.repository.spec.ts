import { MediaType } from '../../../../common/enums/media-type.enum';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

import { DrizzleSitemapRepository } from './drizzle-sitemap.repository';

const buildDb = (orderByResult: Promise<unknown>) => {
  const orderBy = jest.fn().mockReturnValue(orderByResult);
  const where = jest.fn().mockReturnValue({ orderBy });
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  return { db: { select }, where, orderBy };
};

describe('DrizzleSitemapRepository', () => {
  it('returns ready items ordered by slug', async () => {
    const updatedAt = new Date('2026-01-02T03:04:05.000Z');
    const { db, where, orderBy } = buildDb(Promise.resolve([{ slug: 'dune', updatedAt }]));
    const repository = new DrizzleSitemapRepository(db as never);

    const items = await repository.findReadyItems(MediaType.MOVIE);

    expect(items).toEqual([{ slug: 'dune', updatedAt }]);
    expect(where).toHaveBeenCalledTimes(1);
    expect(orderBy).toHaveBeenCalledTimes(1);
  });

  it('wraps database failures in DatabaseException', async () => {
    const { db } = buildDb(Promise.reject(new Error('connection lost')));
    const repository = new DrizzleSitemapRepository(db as never);

    await expect(repository.findReadyItems(MediaType.SHOW)).rejects.toBeInstanceOf(
      DatabaseException,
    );
  });
});
