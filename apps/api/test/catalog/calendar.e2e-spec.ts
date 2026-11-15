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

  it('returns viewer flags off for anonymous requests', async () => {
    const res = await ctx.get('/api/catalog/shows/calendar').expect(200);
    const [episode] = res.body.data.days[0].episodes;
    expect(episode).toMatchObject({ isTracked: false, isSaved: false, isWatched: false });
    expect(ctx.showsRepo.lastCalendarOptions).toEqual({});
  });

  it('requires a viewer for the personalized calendar', async () => {
    await ctx.get('/api/catalog/shows/calendar?personalized=true').expect(401);
  });

  it('personalizes the calendar for the signed-in viewer', async () => {
    const token = await ctx.registerAndLogin();
    const res = await ctx.get('/api/catalog/shows/calendar?personalized=true', token).expect(200);

    expect(ctx.showsRepo.lastCalendarOptions).toEqual({
      viewerId: expect.any(String),
      personalized: true,
    });
    expect(res.body.data.days[0].episodes[0].isTracked).toBe(true);
    expect(typeof res.body.data.watchingShowsCount).toBe('number');
  });

  it('rejects invalid days param', async () => {
    await ctx.get('/api/catalog/shows/calendar?days=-1').expect(400);
  });

  it('rejects invalid startDate', async () => {
    await ctx.get('/api/catalog/shows/calendar?startDate=not-a-date').expect(400);
  });
});
