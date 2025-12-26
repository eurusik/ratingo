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
    expect(
      within7.body.data.data.every(
        (m: any) =>
          m.card && m.card.badgeKey === 'NEW_RELEASE' && m.card.listContext === 'NEW_RELEASES_LIST',
      ),
    ).toBe(true);

    const filtered = await ctx
      .get(
        '/api/catalog/movies/new-releases?genres=drama&minRatingo=50&voteSource=tmdb&minVotes=40',
      )
      .expect(200);
    expect(filtered.body.data.data.map((m: any) => m.id)).toEqual(['mid-2']);
    expect(
      filtered.body.data.data.every(
        (m: any) =>
          m.card && m.card.badgeKey === 'NEW_RELEASE' && m.card.listContext === 'NEW_RELEASES_LIST',
      ),
    ).toBe(true);
  });

  it('new-on-digital: daysBack and filters', async () => {
    const within7 = await ctx.get('/api/catalog/movies/new-on-digital?daysBack=7').expect(200);
    expect(within7.body.data.data.map((m: any) => m.id)).toEqual(['mid-1', 'mid-4']);
    expect(
      within7.body.data.data.every(
        (m: any) =>
          m.card &&
          m.card.badgeKey === 'NEW_ON_STREAMING' &&
          m.card.listContext === 'NEW_ON_STREAMING_LIST',
      ),
    ).toBe(true);

    const filtered = await ctx
      .get('/api/catalog/movies/new-on-digital?genres=comedy&minRatingo=30')
      .expect(200);
    expect(filtered.body.data.data.map((m: any) => m.id)).toEqual(['mid-4']);
    expect(
      filtered.body.data.data.every(
        (m: any) =>
          m.card &&
          m.card.badgeKey === 'NEW_ON_STREAMING' &&
          m.card.listContext === 'NEW_ON_STREAMING_LIST',
      ),
    ).toBe(true);
  });

  it('new-releases: daysBack defaults (0 and missing) apply server defaults', async () => {
    await ctx.get('/api/catalog/movies/new-releases?daysBack=0&limit=1&offset=0').expect(200);
    expect(ctx.moviesRepo.lastNewReleasesOptions?.daysBack).toBe(30);

    await ctx.get('/api/catalog/movies/new-releases?limit=1&offset=0').expect(200);
    expect(ctx.moviesRepo.lastNewReleasesOptions?.daysBack).toBe(30);
  });

  it('new-on-digital: daysBack defaults (0 and missing) apply server defaults', async () => {
    await ctx.get('/api/catalog/movies/new-on-digital?daysBack=0&limit=1&offset=0').expect(200);
    expect(ctx.moviesRepo.lastNewOnDigitalOptions?.daysBack).toBe(14);

    await ctx.get('/api/catalog/movies/new-on-digital?limit=1&offset=0').expect(200);
    expect(ctx.moviesRepo.lastNewOnDigitalOptions?.daysBack).toBe(14);
  });

  it('rejects unknown query params (forbidNonWhitelisted)', async () => {
    const endpoints = ['now-playing', 'new-releases', 'new-on-digital'];
    for (const ep of endpoints) {
      await ctx.get(`/api/catalog/movies/${ep}?foo=bar`).expect(400);
    }
  });

  it('validates query params for listings', async () => {
    const endpoints = ['now-playing', 'new-releases', 'new-on-digital'] as const;

    const commonQueries = [
      '?limit=0',
      '?limit=51',
      '?offset=-1',
      '?sort=invalid',
      '?order=invalid',
      '?minRatingo=101',
      '?minRatingo=abc',
      '?voteSource=invalid',
      '?minVotes=-1',
      '?minVotes=abc',
      '?year=2200',
      '?yearFrom=2200',
      '?yearTo=1800',
      '?year=2020&yearFrom=2019',
      '?yearFrom=2021&yearTo=2020',
    ];

    for (const ep of endpoints) {
      for (const q of commonQueries) {
        await ctx.get(`/api/catalog/movies/${ep}${q}`).expect(400);
      }
    }

    // daysBack is only supported by days endpoints
    await ctx.get('/api/catalog/movies/new-releases?daysBack=-1').expect(400);
    await ctx.get('/api/catalog/movies/new-on-digital?daysBack=-1').expect(400);
  });

  it('meta total/hasMore for listings', async () => {
    const res = await ctx.get('/api/catalog/movies/now-playing?limit=2&offset=0').expect(200);
    expect(res.body.data.meta.total).toBe(4);
    expect(res.body.data.meta.hasMore).toBe(true);
  });

  it('meta invariants: last page and offset beyond total', async () => {
    // now-playing (total=4)
    const nowLast = await ctx.get('/api/catalog/movies/now-playing?limit=2&offset=2').expect(200);
    expect(nowLast.body.data.meta.total).toBe(4);
    expect(nowLast.body.data.meta.count).toBe(2);
    expect(nowLast.body.data.meta.hasMore).toBe(false);

    const nowBeyond = await ctx
      .get('/api/catalog/movies/now-playing?limit=2&offset=10')
      .expect(200);
    expect(nowBeyond.body.data.meta.total).toBe(4);
    expect(nowBeyond.body.data.meta.count).toBe(0);
    expect(nowBeyond.body.data.meta.hasMore).toBe(false);

    // new-releases (default daysBack=30 => total=3)
    const relLast = await ctx.get('/api/catalog/movies/new-releases?limit=2&offset=2').expect(200);
    expect(relLast.body.data.meta.total).toBe(3);
    expect(relLast.body.data.meta.count).toBe(1);
    expect(relLast.body.data.meta.hasMore).toBe(false);

    const relBeyond = await ctx
      .get('/api/catalog/movies/new-releases?limit=2&offset=10')
      .expect(200);
    expect(relBeyond.body.data.meta.total).toBe(3);
    expect(relBeyond.body.data.meta.count).toBe(0);
    expect(relBeyond.body.data.meta.hasMore).toBe(false);

    // new-on-digital (default daysBack=14 => total=2)
    const digLast = await ctx
      .get('/api/catalog/movies/new-on-digital?limit=2&offset=0')
      .expect(200);
    expect(digLast.body.data.meta.total).toBe(2);
    expect(digLast.body.data.meta.count).toBe(2);
    expect(digLast.body.data.meta.hasMore).toBe(false);

    const digBeyond = await ctx
      .get('/api/catalog/movies/new-on-digital?limit=2&offset=10')
      .expect(200);
    expect(digBeyond.body.data.meta.total).toBe(2);
    expect(digBeyond.body.data.meta.count).toBe(0);
    expect(digBeyond.body.data.meta.hasMore).toBe(false);
  });
});
