import { UsersE2eContext, createUsersApp } from './users/_harness';
import { testUuid } from './support/test-uuid';

const WATCHING_ID = testUuid('activity-watching');
const WATCHING_WITH_PROGRESS_ID = testUuid('activity-watching-with-progress');
const PLANNED_ID = testUuid('activity-planned');

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

    await ctx.patchUserMedia(WATCHING_ID, accessToken).send({ state: 'watching' }).expect(200);

    await ctx
      .patchUserMedia(WATCHING_WITH_PROGRESS_ID, accessToken)
      .send({ state: 'watching', progress: { seasons: { 1: 1 } } })
      .expect(200);

    await ctx.patchUserMedia(PLANNED_ID, accessToken).send({ state: 'planned' }).expect(200);

    const res = await ctx.get('/api/me/activity?limit=10&offset=0', accessToken).expect(200);
    expect(res.body.success).toBe(true);

    const ids = res.body.data.data.map((i: any) => i.mediaItemId);
    expect(ids).toEqual(expect.arrayContaining([WATCHING_ID, WATCHING_WITH_PROGRESS_ID]));
    expect(ids).not.toContain(PLANNED_ID);

    expect(res.body.data.meta.total).toBe(2);
    expect(res.body.data.meta.hasMore).toBe(false);
  });
});
