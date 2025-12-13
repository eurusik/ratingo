import { createCatalogApp, CatalogE2eContext } from './_harness';

describe('Catalog E2E - Calendar', () => {
  let ctx: CatalogE2eContext;

  beforeAll(async () => {
    ctx = await createCatalogApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('returns grouped days', async () => {
    const res = await ctx.get('/api/catalog/shows/calendar').expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.days)).toBe(true);
    expect(res.body.data.days.length).toBeGreaterThan(0);
    expect(res.body.data.days[0].episodes.length).toBeGreaterThan(0);
  });

  it('respects startDate and days parameters', async () => {
    const startDate = '2024-01-01T00:00:00.000Z';
    const res = await ctx
      .get(`/api/catalog/shows/calendar?startDate=${encodeURIComponent(startDate)}&days=1`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.startDate).toBe(startDate);
    expect(res.body.data.days[0].date).toBe('2024-01-01');
  });

  it('rejects invalid days param', async () => {
    await ctx.get('/api/catalog/shows/calendar?days=-1').expect(400);
  });
});
