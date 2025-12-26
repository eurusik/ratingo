import { UsersE2eContext, createUsersApp } from './users/_harness';

describe('Me activity e2e', () => {
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

  it('returns watching items and items with progress (meta.total/hasMore)', async () => {
    const { accessToken } = await ctx.registerAndLogin();

    await ctx.patch('/api/user-media/mid-a1', accessToken).send({ state: 'watching' }).expect(200);

    // First set watching with progress, then update to completed without progress
    await ctx
      .patch('/api/user-media/sid-a2', accessToken)
      .send({ state: 'watching', progress: { seasons: { 1: 1 } } })
      .expect(200);

    await ctx.patch('/api/user-media/mid-a3', accessToken).send({ state: 'planned' }).expect(200);

    const res = await ctx.get('/api/me/activity?limit=10&offset=0', accessToken).expect(200);
    expect(res.body.success).toBe(true);

    const ids = res.body.data.data.map((i: any) => i.mediaItemId);
    expect(ids).toEqual(expect.arrayContaining(['mid-a1', 'sid-a2']));
    expect(ids).not.toContain('mid-a3');

    expect(res.body.data.meta.total).toBe(2);
    expect(res.body.data.meta.hasMore).toBe(false);
  });
});
