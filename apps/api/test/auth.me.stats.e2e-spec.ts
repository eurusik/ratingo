import { UsersE2eContext, createUsersApp } from './users/_harness';
import { testUuid } from './support/test-uuid';

const RATED_MOVIE_ID = testUuid('rated-movie');
const RATED_SHOW_ID = testUuid('rated-show');
const PLANNED_MOVIE_ID = testUuid('planned-movie');

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

    await ctx
      .patchUserMedia(RATED_MOVIE_ID, accessToken)
      .send({ state: 'completed', rating: 80 })
      .expect(200);

    ctx.userMediaRepo.registerShow(RATED_SHOW_ID);
    await ctx
      .patchUserMedia(RATED_SHOW_ID, accessToken)
      .send({ state: 'completed', rating: 90 })
      .expect(200);

    await ctx.patchUserMedia(PLANNED_MOVIE_ID, accessToken).send({ state: 'planned' }).expect(200);

    const meRes = await ctx.get('/api/auth/me', accessToken).expect(200);
    expect(meRes.body.success).toBe(true);

    expect(meRes.body.data.stats).toEqual({
      moviesRated: 1,
      showsRated: 1,
      watchlistCount: 1,
    });
  });
});
