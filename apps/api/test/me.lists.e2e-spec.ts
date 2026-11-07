import { UsersE2eContext, createUsersApp } from './users/_harness';
import { testUuid } from './support/test-uuid';

const RATED_SIXTY_ID = testUuid('rated-sixty');
const RATED_SEVENTY_ID = testUuid('rated-seventy');
const RATED_EIGHTY_ID = testUuid('rated-eighty');
const PLANNED_ID = testUuid('planned');
const WATCHING_ID = testUuid('watching');
const HISTORY_WATCHING_ID = testUuid('history-watching');
const HISTORY_COMPLETED_ID = testUuid('history-completed');
const HISTORY_PLANNED_ID = testUuid('history-planned');

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
      .patchUserMedia(RATED_SIXTY_ID, accessToken)
      .send({ state: 'completed', rating: 60 })
      .expect(200);
    await ctx
      .patchUserMedia(RATED_SEVENTY_ID, accessToken)
      .send({ state: 'completed', rating: 70 })
      .expect(200);
    await ctx
      .patchUserMedia(RATED_EIGHTY_ID, accessToken)
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

    await ctx.patchUserMedia(PLANNED_ID, accessToken).send({ state: 'planned' }).expect(200);
    await ctx.patchUserMedia(WATCHING_ID, accessToken).send({ state: 'watching' }).expect(200);

    const res = await ctx.get('/api/me/watchlist?limit=20&offset=0', accessToken).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data.map((i: any) => i.mediaItemId)).toEqual([PLANNED_ID]);
    expect(res.body.data.meta.total).toBe(1);
  });

  it('history: includes watching and completed', async () => {
    const { accessToken } = await ctx.registerAndLogin();

    await ctx
      .patchUserMedia(HISTORY_WATCHING_ID, accessToken)
      .send({ state: 'watching' })
      .expect(200);
    await ctx
      .patchUserMedia(HISTORY_COMPLETED_ID, accessToken)
      .send({ state: 'completed' })
      .expect(200);
    await ctx
      .patchUserMedia(HISTORY_PLANNED_ID, accessToken)
      .send({ state: 'planned' })
      .expect(200);

    const res = await ctx.get('/api/me/history?limit=20&offset=0', accessToken).expect(200);
    expect(res.body.success).toBe(true);
    const ids = res.body.data.data.map((i: any) => i.mediaItemId);
    expect(ids).toHaveLength(2);
    expect(ids).toEqual(expect.arrayContaining([HISTORY_WATCHING_ID, HISTORY_COMPLETED_ID]));
    expect(res.body.data.meta.total).toBe(2);
  });
});
