/**
 * No Duplicates E2E Tests
 *
 * Safety net tests to ensure that public catalog queries never return duplicate items.
 * This prevents regressions where JOIN with media_catalog_evaluations without proper
 * policy_version filtering could cause duplicates when multiple policy versions exist.
 *
 */

import { createCatalogApp, CatalogE2eContext } from './_harness';

describe('Catalog E2E - No Duplicates Safety Net', () => {
  let ctx: CatalogE2eContext;

  beforeAll(async () => {
    ctx = await createCatalogApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  /**
   * Helper to check for duplicate IDs in response data
   */
  const assertNoDuplicateIds = (items: any[], endpoint: string) => {
    const ids = items.map((item: any) => item.id);
    const uniqueIds = new Set(ids);

    if (ids.length !== uniqueIds.size) {
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      throw new Error(
        `Duplicate IDs found in ${endpoint}: [${duplicates.join(', ')}]. ` +
          `Total: ${ids.length}, Unique: ${uniqueIds.size}`,
      );
    }

    expect(ids.length).toBe(uniqueIds.size);
  };

  describe('Trending endpoints', () => {
    it('trending movies should not contain duplicate IDs', async () => {
      const res = await ctx.get('/api/catalog/movies/trending').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.data)).toBe(true);

      assertNoDuplicateIds(res.body.data.data, '/api/catalog/movies/trending');
    });

    it('trending shows should not contain duplicate IDs', async () => {
      const res = await ctx.get('/api/catalog/shows/trending').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.data)).toBe(true);

      assertNoDuplicateIds(res.body.data.data, '/api/catalog/shows/trending');
    });
  });

  describe('Movie listings endpoints', () => {
    it('now playing movies should not contain duplicate IDs', async () => {
      const res = await ctx.get('/api/catalog/movies/now-playing').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.data)).toBe(true);

      assertNoDuplicateIds(res.body.data.data, '/api/catalog/movies/now-playing');
    });

    it('new releases movies should not contain duplicate IDs', async () => {
      const res = await ctx.get('/api/catalog/movies/new-releases').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.data)).toBe(true);

      assertNoDuplicateIds(res.body.data.data, '/api/catalog/movies/new-releases');
    });

    it('new on digital movies should not contain duplicate IDs', async () => {
      const res = await ctx.get('/api/catalog/movies/new-on-digital').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.data)).toBe(true);

      assertNoDuplicateIds(res.body.data.data, '/api/catalog/movies/new-on-digital');
    });
  });

  describe('Pagination consistency', () => {
    it('trending movies pagination should not have overlapping IDs between pages', async () => {
      const page1 = await ctx.get('/api/catalog/movies/trending?limit=2&offset=0').expect(200);
      const page2 = await ctx.get('/api/catalog/movies/trending?limit=2&offset=2').expect(200);

      const page1Ids = new Set(page1.body.data.data.map((m: any) => m.id));
      const page2Ids = page2.body.data.data.map((m: any) => m.id);

      const overlapping = page2Ids.filter((id: string) => page1Ids.has(id));

      expect(overlapping).toEqual([]);
    });

    it('trending shows pagination should not have overlapping IDs between pages', async () => {
      const page1 = await ctx.get('/api/catalog/shows/trending?limit=1&offset=0').expect(200);
      const page2 = await ctx.get('/api/catalog/shows/trending?limit=1&offset=1').expect(200);

      if (page1.body.data.data.length > 0 && page2.body.data.data.length > 0) {
        const page1Ids = new Set(page1.body.data.data.map((s: any) => s.id));
        const page2Ids = page2.body.data.data.map((s: any) => s.id);

        const overlapping = page2Ids.filter((id: string) => page1Ids.has(id));

        expect(overlapping).toEqual([]);
      }
    });
  });

  describe('mediaItemId consistency', () => {
    it('all trending movie items should have matching id and mediaItemId', async () => {
      const res = await ctx.get('/api/catalog/movies/trending').expect(200);

      res.body.data.data.forEach((item: any) => {
        expect(item.mediaItemId).toBeDefined();
        expect(item.mediaItemId).toBe(item.id);
      });
    });

    it('all trending show items should have matching id and mediaItemId', async () => {
      const res = await ctx.get('/api/catalog/shows/trending').expect(200);

      res.body.data.data.forEach((item: any) => {
        expect(item.mediaItemId).toBeDefined();
        expect(item.mediaItemId).toBe(item.id);
      });
    });
  });
});
