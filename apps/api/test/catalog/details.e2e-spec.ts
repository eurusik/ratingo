import { createCatalogApp, CatalogE2eContext } from './_harness';
import { MOVIE_ONE_ID, SHOW_ONE_ID } from './_fixtures';

describe('Catalog E2E - Details (movies/shows)', () => {
  let ctx: CatalogE2eContext;

  beforeAll(async () => {
    ctx = await createCatalogApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('movie detail: anon vs auth userState and 404', async () => {
    const anon = await ctx.get('/api/catalog/movies/movie-one').expect(200);
    expect(anon.body.data.userState).toBeNull();

    const token = await ctx.registerAndLogin();
    await ctx.setUserState(token, MOVIE_ONE_ID);

    const auth = await ctx.get('/api/catalog/movies/movie-one', token).expect(200);
    expect(auth.body.data.userState).not.toBeNull();

    await ctx.get('/api/catalog/movies/unknown').expect(404);
  });

  it('show detail: anon vs auth userState and 404', async () => {
    const anon = await ctx.get('/api/catalog/shows/show-one').expect(200);
    expect(anon.body.data.userState).toBeNull();

    const token = await ctx.registerAndLogin();
    await ctx.setUserState(token, SHOW_ONE_ID);

    const auth = await ctx.get('/api/catalog/shows/show-one', token).expect(200);
    expect(auth.body.data.userState).not.toBeNull();

    await ctx.get('/api/catalog/shows/unknown').expect(404);
  });

  describe('show verdict + statusHint', () => {
    it('should return verdict for good show with statusHint', async () => {
      const res = await ctx.get('/api/catalog/shows/show-one').expect(200);
      const { verdict, statusHint } = res.body.data;

      expect(verdict).toBeDefined();
      expect(verdict.type).toMatch(/quality|popularity/);
      expect(verdict.messageKey).toBeDefined();
      expect(verdict.hintKey).toBeDefined();

      expect(statusHint).toBeDefined();
      expect(statusHint.messageKey).toBe('newSeason');
    });

    it('should return cancelled warning for cancelled show without statusHint', async () => {
      const res = await ctx.get('/api/catalog/shows/show-two').expect(200);
      const { verdict, statusHint } = res.body.data;

      expect(verdict).toBeDefined();
      expect(verdict.type).toBe('warning');
      expect(verdict.messageKey).toBe('cancelled');

      expect(statusHint).toBeNull();
    });

    it('should never return statusHint for warning verdicts (invariant)', async () => {
      const res = await ctx.get('/api/catalog/shows/show-two').expect(200);
      const { verdict, statusHint } = res.body.data;

      if (verdict.type === 'warning') {
        expect(statusHint).toBeNull();
      }
    });
  });
});
