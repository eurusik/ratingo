import { createCatalogApp, CatalogE2eContext } from './_harness';

describe('Catalog E2E - Movies Listings', () => {
  let ctx: CatalogE2eContext;

  beforeAll(async () => {
    ctx = await createCatalogApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('now-playing: sorting and filtering', async () => {
    const sorted = await ctx
      .get('/api/catalog/movies/now-playing?sort=tmdbPopularity&order=desc')
      .expect(200);
    expect(sorted.body.data.data.map((m: any) => m.id)).toEqual([
      'mid-1',
      'mid-2',
      'mid-3',
      'mid-4',
    ]);

    const filtered = await ctx
      .get('/api/catalog/movies/now-playing?genres=action&minRatingo=70')
      .expect(200);
    expect(filtered.body.data.data.map((m: any) => m.id)).toEqual(['mid-1']);
  });

  it('new-releases: daysBack window and filters', async () => {
    const within7 = await ctx.get('/api/catalog/movies/new-releases?daysBack=7').expect(200);
    expect(within7.body.data.data.map((m: any) => m.id)).toEqual(['mid-1', 'mid-2']);

    const filtered = await ctx
      .get(
        '/api/catalog/movies/new-releases?genres=drama&minRatingo=50&voteSource=tmdb&minVotes=40',
      )
      .expect(200);
    expect(filtered.body.data.data.map((m: any) => m.id)).toEqual(['mid-2']);
  });

  it('new-on-digital: daysBack and filters', async () => {
    const within7 = await ctx.get('/api/catalog/movies/new-on-digital?daysBack=7').expect(200);
    expect(within7.body.data.data.map((m: any) => m.id)).toEqual(['mid-1', 'mid-4']);

    const filtered = await ctx
      .get('/api/catalog/movies/new-on-digital?genres=comedy&minRatingo=30')
      .expect(200);
    expect(filtered.body.data.data.map((m: any) => m.id)).toEqual(['mid-4']);
  });

  it('meta total/hasMore for listings', async () => {
    const res = await ctx.get('/api/catalog/movies/now-playing?limit=2&offset=0').expect(200);
    expect(res.body.data.meta.total).toBe(4);
    expect(res.body.data.meta.hasMore).toBe(true);
  });
});
