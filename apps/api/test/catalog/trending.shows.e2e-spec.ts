import { createCatalogApp, CatalogE2eContext } from './_harness';

describe('Catalog E2E - Trending Shows', () => {
  let ctx: CatalogE2eContext;

  beforeAll(async () => {
    ctx = await createCatalogApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('enriches userState for auth and null for anon', async () => {
    const anon = await ctx.get('/api/catalog/shows/trending').expect(200);
    expect(anon.body.data.data.every((m: any) => m.userState === null)).toBe(true);

    const token = await ctx.registerAndLogin();
    await ctx.setUserState(token, 'sid-1');

    const auth = await ctx.get('/api/catalog/shows/trending', token).expect(200);
    const withState = auth.body.data.data.find((m: any) => m.id === 'sid-1');
    const withoutState = auth.body.data.data.find((m: any) => m.id === 'sid-2');
    expect(withState.userState).not.toBeNull();
    expect(withoutState.userState).toBeNull();
  });

  it('applies sorting (popularity desc default) and order asc', async () => {
    const desc = await ctx.get('/api/catalog/shows/trending').expect(200);
    expect(desc.body.data.data.map((s: any) => s.id)).toEqual(['sid-1', 'sid-2']);

    const asc = await ctx.get('/api/catalog/shows/trending?sort=popularity&order=asc').expect(200);
    expect(asc.body.data.data.map((s: any) => s.id)).toEqual(['sid-2', 'sid-1']);
  });

  it('applies filtering by genres and minVotes/voteSource', async () => {
    const genresRes = await ctx.get('/api/catalog/shows/trending?genres=action').expect(200);
    expect(genresRes.body.data.data.map((s: any) => s.id)).toEqual(['sid-2']);

    const votesRes = await ctx
      .get('/api/catalog/shows/trending?voteSource=tmdb&minVotes=15')
      .expect(200);
    expect(votesRes.body.data.data.map((s: any) => s.id)).toEqual(['sid-1']);
  });

  it('applies year filters', async () => {
    const yearRes = await ctx.get('/api/catalog/shows/trending?year=2024').expect(200);
    expect(yearRes.body.data.data.map((s: any) => s.id)).toEqual(['sid-1']);

    const rangeRes = await ctx
      .get('/api/catalog/shows/trending?yearFrom=2023&yearTo=2024')
      .expect(200);
    expect(rangeRes.body.data.data.map((s: any) => s.id)).toEqual(['sid-1']);
  });

  it('returns correct meta total/hasMore across pages', async () => {
    const page1 = await ctx.get('/api/catalog/shows/trending?limit=1&offset=0').expect(200);
    expect(page1.body.data.meta.total).toBe(2);
    expect(page1.body.data.meta.hasMore).toBe(true);

    const page2 = await ctx.get('/api/catalog/shows/trending?limit=1&offset=1').expect(200);
    expect(page2.body.data.meta.total).toBe(2);
    expect(page2.body.data.meta.hasMore).toBe(false);
  });
});
