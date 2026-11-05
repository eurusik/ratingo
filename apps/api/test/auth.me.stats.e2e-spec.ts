import { UsersE2eContext, createUsersApp } from './users/_harness';
import { testUuid } from './support/test-uuid';

describe('Auth /me stats e2e', () => {
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

  it('returns real stats after user-media updates', async () => {
    const { accessToken } = await ctx.registerAndLogin();

    // movie rated
    await ctx
      .patch(`/api/user-media/${testUuid('mid-1')}`, accessToken)
      .send({ state: 'completed', rating: 80 })
      .expect(200);

    const showId = testUuid('sid-1');
    ctx.userMediaRepo.registerShow(showId);
    await ctx
      .patch(`/api/user-media/${showId}`, accessToken)
      .send({ state: 'completed', rating: 90 })
      .expect(200);

    // watchlist item (planned)
    await ctx
      .patch(`/api/user-media/${testUuid('mid-2')}`, accessToken)
      .send({ state: 'planned' })
      .expect(200);

    const meRes = await ctx.get('/api/auth/me', accessToken).expect(200);
    expect(meRes.body.success).toBe(true);

    expect(meRes.body.data.stats).toEqual({
      moviesRated: 1,
      showsRated: 1,
      watchlistCount: 1,
    });
  });
});
