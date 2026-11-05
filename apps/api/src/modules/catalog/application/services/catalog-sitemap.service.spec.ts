import { MediaType } from '../../../../common/enums/media-type.enum';
import { type ISitemapRepository } from '../../domain/repositories/sitemap.repository.interface';

import { CatalogSitemapService } from './catalog-sitemap.service';

describe('CatalogSitemapService', () => {
  const items = [{ slug: 'slug', updatedAt: new Date('2026-01-01T00:00:00.000Z') }];
  let repository: jest.Mocked<ISitemapRepository>;
  let service: CatalogSitemapService;

  beforeEach(() => {
    repository = { findReadyItems: jest.fn().mockResolvedValue(items) };
    service = new CatalogSitemapService(repository);
  });

  it('requests ready movies for the movie sitemap', async () => {
    await expect(service.getMovieSitemapItems()).resolves.toBe(items);
    expect(repository.findReadyItems).toHaveBeenCalledWith(MediaType.MOVIE);
  });

  it('requests ready shows for the show sitemap', async () => {
    await expect(service.getShowSitemapItems()).resolves.toBe(items);
    expect(repository.findReadyItems).toHaveBeenCalledWith(MediaType.SHOW);
  });
});
