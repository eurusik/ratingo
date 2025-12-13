import { UsersE2eContext, createUsersApp } from './_harness';

describe('Users /me e2e', () => {
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

  it('me: requires auth and returns user without password', async () => {
    await ctx.get(`${ctx.usersBase}/me`).expect(401);

    const { accessToken } = await ctx.registerAndLogin();

    const meRes = await ctx.get(`${ctx.usersBase}/me`, accessToken).expect(200);

    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.email).toBeDefined();
    expect(meRes.body.data.passwordHash).toBeUndefined();
  });
});
