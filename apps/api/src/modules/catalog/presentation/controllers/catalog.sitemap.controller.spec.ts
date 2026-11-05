import { type CatalogSitemapService } from '../../application/services/catalog-sitemap.service';

import { CatalogSitemapController } from './catalog.sitemap.controller';

describe('CatalogSitemapController', () => {
  const updatedAt = new Date('2026-01-02T03:04:05.000Z');
  const sitemapService = {
    getMovieSitemapItems: jest.fn().mockResolvedValue([{ slug: 'dune', updatedAt }]),
    getShowSitemapItems: jest.fn().mockResolvedValue([{ slug: 'severance', updatedAt }]),
  };
  const controller = new CatalogSitemapController(
    sitemapService as unknown as CatalogSitemapService,
  );

  it('serializes movie updatedAt as ISO 8601', async () => {
    await expect(controller.getMovieSitemap()).resolves.toEqual({
      items: [{ slug: 'dune', updatedAt: '2026-01-02T03:04:05.000Z' }],
    });
  });

  it('serializes show updatedAt as ISO 8601', async () => {
    await expect(controller.getShowSitemap()).resolves.toEqual({
      items: [{ slug: 'severance', updatedAt: '2026-01-02T03:04:05.000Z' }],
    });
  });
});
