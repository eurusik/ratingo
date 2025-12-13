import { createCatalogApp, CatalogE2eContext } from './_harness';

describe('Catalog E2E - Search', () => {
  let ctx: CatalogE2eContext;

  beforeAll(async () => {
    ctx = await createCatalogApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('returns stubbed result for valid query', async () => {
    const res = await ctx.get('/api/catalog/search?query=mo').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.local.length).toBe(1);
    expect(res.body.data.local[0].id).toBe('mid-1');
  });

  it('returns empty results for missing/too short query', async () => {
    const missing = await ctx.get('/api/catalog/search').expect(200);
    expect(missing.body.success).toBe(true);
    expect(missing.body.data.local.length).toBe(0);
    expect(missing.body.data.tmdb.length).toBe(0);

    const short = await ctx.get('/api/catalog/search?query=a').expect(200);
    expect(short.body.success).toBe(true);
    expect(short.body.data.local.length).toBe(0);
    expect(short.body.data.tmdb.length).toBe(0);
  });
});
