import { UsersE2eContext, createUsersApp } from './users/_harness';

describe('Me lists e2e', () => {
  let ctx: UsersE2eContext;

  beforeAll(async () => {
    ctx = await createUsersApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  afterEach(() => {
    ctx.userMediaRepo.clear();
  });

  it('ratings: returns meta.total/hasMore and respects pagination', async () => {
    const { accessToken } = await ctx.registerAndLogin();

    await ctx
      .patch('/api/user-media/mid-r1', accessToken)
      .send({ state: 'completed', rating: 60 })
      .expect(200);
    await ctx
      .patch('/api/user-media/mid-r2', accessToken)
      .send({ state: 'completed', rating: 70 })
      .expect(200);
    await ctx
      .patch('/api/user-media/mid-r3', accessToken)
      .send({ state: 'completed', rating: 80 })
      .expect(200);

    const page1 = await ctx.get('/api/me/ratings?limit=2&offset=0', accessToken).expect(200);
    expect(page1.body.success).toBe(true);
    expect(page1.body.data.meta.total).toBe(3);
    expect(page1.body.data.meta.count).toBe(2);
    expect(page1.body.data.meta.hasMore).toBe(true);

    const page2 = await ctx.get('/api/me/ratings?limit=2&offset=2', accessToken).expect(200);
    expect(page2.body.data.meta.total).toBe(3);
    expect(page2.body.data.meta.count).toBe(1);
    expect(page2.body.data.meta.hasMore).toBe(false);
  });

  it('watchlist: filters planned states only', async () => {
    const { accessToken } = await ctx.registerAndLogin();

    await ctx.patch('/api/user-media/mid-w1', accessToken).send({ state: 'planned' }).expect(200);
    await ctx.patch('/api/user-media/mid-w2', accessToken).send({ state: 'watching' }).expect(200);

    const res = await ctx.get('/api/me/watchlist?limit=20&offset=0', accessToken).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data.map((i: any) => i.mediaItemId)).toEqual(['mid-w1']);
    expect(res.body.data.meta.total).toBe(1);
  });

  it('history: includes watching and completed', async () => {
    const { accessToken } = await ctx.registerAndLogin();

    await ctx.patch('/api/user-media/mid-h1', accessToken).send({ state: 'watching' }).expect(200);
    await ctx.patch('/api/user-media/mid-h2', accessToken).send({ state: 'completed' }).expect(200);
    await ctx.patch('/api/user-media/mid-h3', accessToken).send({ state: 'planned' }).expect(200);

    const res = await ctx.get('/api/me/history?limit=20&offset=0', accessToken).expect(200);
    expect(res.body.success).toBe(true);
    const ids = res.body.data.data.map((i: any) => i.mediaItemId);
    expect(ids.sort()).toEqual(['mid-h1', 'mid-h2']);
    expect(res.body.data.meta.total).toBe(2);
  });
});
