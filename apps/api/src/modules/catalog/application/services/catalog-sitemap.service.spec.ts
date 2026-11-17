import { type ISitemapRepository } from '@/modules/catalog/domain/repositories/sitemap.repository.interface';

import { CatalogSitemapService } from './catalog-sitemap.service';

describe('CatalogSitemapService', () => {
  const now = new Date('2026-11-17T12:00:00.000Z');
  const items = [{ slug: 'slug', updatedAt: new Date('2026-01-01T00:00:00.000Z') }];
  let repository: jest.Mocked<ISitemapRepository>;
  let service: CatalogSitemapService;

  beforeEach(() => {
    repository = {
      findReleasedMovies: jest.fn().mockResolvedValue(items),
      findReadyShows: jest.fn().mockResolvedValue(items),
    };
    service = new CatalogSitemapService(repository, { now: () => now });
  });

  it('requests movies released by now for the movie sitemap', async () => {
    await expect(service.getMovieSitemapItems()).resolves.toBe(items);
    expect(repository.findReleasedMovies).toHaveBeenCalledWith(now);
  });

  it('requests ready shows for the show sitemap', async () => {
    await expect(service.getShowSitemapItems()).resolves.toBe(items);
    expect(repository.findReadyShows).toHaveBeenCalledWith();
  });
});
