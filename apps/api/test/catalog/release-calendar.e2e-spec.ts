import { createCatalogApp, CatalogE2eContext } from './_harness';

describe('Catalog E2E - Release calendar and upcoming movies', () => {
  let ctx: CatalogE2eContext;

  beforeAll(async () => {
    ctx = await createCatalogApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /catalog/movies/upcoming', () => {
    it('lists upcoming movies from today with release labels and pagination', async () => {
      const res = await ctx.get('/api/catalog/movies/upcoming?limit=1').expect(200);

      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.data[0]).toMatchObject({
        releaseDateKind: 'theatrical',
        releaseCountry: 'US',
      });
      expect(res.body.data.meta).toMatchObject({ limit: 1, offset: 0 });

      const { from, toExclusive } = ctx.moviesRepo.lastUpcomingOptions!;
      expect(from.toISOString()).toMatch(/T00:00:00\.000Z$/);
      expect((toExclusive.getTime() - from.getTime()) / 86_400_000).toBe(121);
    });

    it('honours the days window', async () => {
      await ctx.get('/api/catalog/movies/upcoming?days=30').expect(200);

      const { from, toExclusive } = ctx.moviesRepo.lastUpcomingOptions!;
      expect((toExclusive.getTime() - from.getTime()) / 86_400_000).toBe(31);
    });

    it('rejects a window beyond the maximum', async () => {
      await ctx.get('/api/catalog/movies/upcoming?days=366').expect(400);
    });
  });

  describe('GET /catalog/calendar', () => {
    const startDate = '2026-11-20T00:00:00.000Z';

    it('groups episodes and movies by day and counts hidden movies', async () => {
      const res = await ctx
        .get(`/api/catalog/calendar?startDate=${encodeURIComponent(startDate)}&days=1`)
        .expect(200);

      expect(res.body.data.startDate).toBe(startDate);
      expect(res.body.data.endDate).toBe('2026-11-21T00:00:00.000Z');
      const day = res.body.data.days.find((d: { date: string }) => d.date === '2026-11-20');
      expect(day.movies).toHaveLength(1);
      expect(day.moreMoviesCount).toBe(7);
      expect(ctx.moviesRepo.lastCalendarMoviesOptions).toMatchObject({
        personalized: false,
        perDayLimit: 5,
      });
      expect(res.body.data.watchingShowsCount).toBeUndefined();
    });

    it('returns only movies for type=movie', async () => {
      const res = await ctx
        .get(`/api/catalog/calendar?startDate=${encodeURIComponent(startDate)}&type=movie`)
        .expect(200);

      for (const day of res.body.data.days) {
        expect(day.episodes).toEqual([]);
      }
    });

    it('returns only episodes for type=show', async () => {
      ctx.moviesRepo.lastCalendarMoviesOptions = undefined;
      const res = await ctx.get('/api/catalog/calendar?type=show').expect(200);

      expect(ctx.moviesRepo.lastCalendarMoviesOptions).toBeUndefined();
      for (const day of res.body.data.days) {
        expect(day.movies).toEqual([]);
      }
    });

    it('requires a viewer for the personalized calendar', async () => {
      await ctx.get('/api/catalog/calendar?personalized=true').expect(401);
    });

    it("lists the viewer's movies without a per-day limit", async () => {
      const token = await ctx.registerAndLogin();
      const res = await ctx.get('/api/catalog/calendar?personalized=true', token).expect(200);

      expect(ctx.moviesRepo.lastCalendarMoviesOptions).toEqual({
        viewerId: expect.any(String),
        personalized: true,
        perDayLimit: undefined,
      });
      expect(typeof res.body.data.watchingShowsCount).toBe('number');
      const movieDay = res.body.data.days.find((d: { movies: unknown[] }) => d.movies.length);
      expect(movieDay.movies[0].isSavedForLater).toBe(true);
      expect(movieDay.moreMoviesCount).toBeUndefined();
    });

    it.each(['days=91', 'type=anime', 'personalized=yes', 'startDate=not-a-date'])(
      'rejects %s',
      async (param) => {
        await ctx.get(`/api/catalog/calendar?${param}`).expect(400);
      },
    );
  });
});
