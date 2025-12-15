import { createCatalogApp, CatalogE2eContext } from './_harness';

describe('Catalog E2E - Trending Movies', () => {
  let ctx: CatalogE2eContext;

  beforeAll(async () => {
    ctx = await createCatalogApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('enriches userState for auth and null for anon', async () => {
    const anon = await ctx.get('/api/catalog/movies/trending').expect(200);
    expect(anon.body.data.data.every((m: any) => m.userState === null)).toBe(true);
    expect(anon.body.data.data.every((m: any) => m.card && m.card.badgeKey === 'NEW_RELEASE')).toBe(
      true,
    );

    const token = await ctx.registerAndLogin();
    await ctx.setUserState(token, 'mid-1');

    const auth = await ctx.get('/api/catalog/movies/trending', token).expect(200);
    const withState = auth.body.data.data.find((m: any) => m.id === 'mid-1');
    const withoutState = auth.body.data.data.find((m: any) => m.id === 'mid-2');
    expect(withState.userState).not.toBeNull();
    expect(withoutState.userState).toBeNull();
    expect(withState.card).toBeDefined();
    expect(withoutState.card).toBeDefined();
  });

  it('applies sorting (ratingo asc) and stable tie-breaker', async () => {
    const res = await ctx.get('/api/catalog/movies/trending?sort=ratingo&order=asc').expect(200);
    const ids = res.body.data.data.map((m: any) => m.id);
    expect(ids).toEqual(['mid-4', 'mid-3', 'mid-2', 'mid-1']);
  });

  it('applies filtering by genres (OR) and minVotes/voteSource', async () => {
    const genresRes = await ctx.get('/api/catalog/movies/trending?genres=action').expect(200);
    expect(genresRes.body.data.data.map((m: any) => m.id)).toEqual(['mid-1', 'mid-3']);

    const votesRes = await ctx
      .get('/api/catalog/movies/trending?voteSource=tmdb&minVotes=500')
      .expect(200);
    expect(votesRes.body.data.data.map((m: any) => m.id)).toEqual(['mid-3']);
  });

  it('applies year/yearFrom/yearTo filters', async () => {
    const yearRes = await ctx.get('/api/catalog/movies/trending?year=2024').expect(200);
    expect(yearRes.body.data.data.map((m: any) => m.id)).toEqual(['mid-1']);

    const rangeRes = await ctx
      .get('/api/catalog/movies/trending?yearFrom=2020&yearTo=2023')
      .expect(200);
    expect(rangeRes.body.data.data.map((m: any) => m.id)).toEqual(['mid-2', 'mid-3']);
  });

  it('applies minRatingo filter', async () => {
    const res = await ctx.get('/api/catalog/movies/trending?minRatingo=70').expect(200);
    expect(res.body.data.data.map((m: any) => m.id)).toEqual(['mid-1']);
  });

  it('supports sorting by releaseDate and tmdbPopularity', async () => {
    const byReleaseDesc = await ctx
      .get('/api/catalog/movies/trending?sort=releaseDate&order=desc')
      .expect(200);
    expect(byReleaseDesc.body.data.data.map((m: any) => m.id)).toEqual([
      'mid-1',
      'mid-2',
      'mid-3',
      'mid-4',
    ]);

    const byReleaseAsc = await ctx
      .get('/api/catalog/movies/trending?sort=releaseDate&order=asc')
      .expect(200);
    expect(byReleaseAsc.body.data.data.map((m: any) => m.id)).toEqual([
      'mid-4',
      'mid-3',
      'mid-2',
      'mid-1',
    ]);

    const byTmdbPopularityDesc = await ctx
      .get('/api/catalog/movies/trending?sort=tmdbPopularity&order=desc')
      .expect(200);
    expect(byTmdbPopularityDesc.body.data.data.map((m: any) => m.id)).toEqual([
      'mid-1',
      'mid-2',
      'mid-3',
      'mid-4',
    ]);

    const byTmdbPopularityAsc = await ctx
      .get('/api/catalog/movies/trending?sort=tmdbPopularity&order=asc')
      .expect(200);
    expect(byTmdbPopularityAsc.body.data.data.map((m: any) => m.id)).toEqual([
      'mid-4',
      'mid-3',
      'mid-2',
      'mid-1',
    ]);
  });

  it('validates query params', async () => {
    const queries = [
      '?limit=0',
      '?limit=51',
      '?offset=-1',
      '?sort=invalid',
      '?order=invalid',
      '?voteSource=invalid',
      '?minRatingo=101',
      '?year=2200',
      '?yearFrom=2200',
      '?yearTo=1800',
      '?year=2020&yearFrom=2019',
      '?yearFrom=2021&yearTo=2020',
    ];
    for (const q of queries) {
      await ctx.get(`/api/catalog/movies/trending${q}`).expect(400);
    }
  });

  it('rejects unknown query params (forbidNonWhitelisted)', async () => {
    await ctx.get('/api/catalog/movies/trending?foo=bar').expect(400);
  });

  it('returns correct meta total/hasMore across pages', async () => {
    const page1 = await ctx.get('/api/catalog/movies/trending?limit=2&offset=0').expect(200);
    expect(page1.body.data.meta.total).toBe(4);
    expect(page1.body.data.meta.hasMore).toBe(true);

    const page2 = await ctx.get('/api/catalog/movies/trending?limit=2&offset=2').expect(200);
    expect(page2.body.data.meta.total).toBe(4);
    expect(page2.body.data.meta.hasMore).toBe(false);
  });
});
