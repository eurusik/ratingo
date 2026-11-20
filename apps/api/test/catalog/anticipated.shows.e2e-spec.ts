import { createCatalogApp, CatalogE2eContext } from './_harness';

describe('Catalog E2E - Anticipated show premieres', () => {
  let ctx: CatalogE2eContext;

  beforeAll(async () => {
    ctx = await createCatalogApp();
    ctx.showsRepo.anticipated = [
      {
        mediaItemId: '00000000-0000-4000-8000-000000000001',
        slug: 'harry-potter',
        title: 'Гаррі Поттер',
        poster: {
          thumb: 'https://image.tmdb.org/t/p/w154/hp.jpg',
          small: 'https://image.tmdb.org/t/p/w342/hp.jpg',
          medium: 'https://image.tmdb.org/t/p/w500/hp.jpg',
          large: 'https://image.tmdb.org/t/p/w780/hp.jpg',
          original: 'https://image.tmdb.org/t/p/original/hp.jpg',
        },
        premiereDate: new Date('2026-12-25T00:00:00.000Z'),
        listCount: 60000,
      },
    ];
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('lists anticipated premieres in a 90-day window above the list threshold', async () => {
    const res = await ctx.get('/api/catalog/shows/anticipated?limit=10').expect(200);

    expect(res.body.data.data).toEqual([
      expect.objectContaining({
        slug: 'harry-potter',
        premiereDate: '2026-12-25T00:00:00.000Z',
        listCount: 60000,
      }),
    ]);
    const { from, toExclusive, minListCount, limit } = ctx.showsRepo.lastAnticipatedOptions!;
    expect(from.toISOString()).toMatch(/T00:00:00\.000Z$/);
    expect((toExclusive.getTime() - from.getTime()) / 86_400_000).toBe(91);
    expect(minListCount).toBe(1000);
    expect(limit).toBe(10);
  });

  it('rejects a limit above the maximum', async () => {
    await ctx.get('/api/catalog/shows/anticipated?limit=51').expect(400);
  });
});
