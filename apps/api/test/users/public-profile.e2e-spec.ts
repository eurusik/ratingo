import { UsersE2eContext, createUsersApp } from './_harness';

describe('Users public profile e2e', () => {
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

  it('public profile: returns 200 for public user and 404 for private to guest', async () => {
    await ctx.usersRepo.create({
      email: 'public@example.com',
      username: 'public_user',
      passwordHash: 'hash',
      isProfilePublic: true,
    } as any);

    const pubRes = await ctx.get(`${ctx.usersBase}/public_user`).expect(200);
    expect(pubRes.body.success).toBe(true);
    expect(pubRes.body.data.username).toBe('public_user');

    await ctx.usersRepo.create({
      email: 'private@example.com',
      username: 'private_user',
      passwordHash: 'hash',
      isProfilePublic: false,
    } as any);

    await ctx.get(`${ctx.usersBase}/private_user`).expect(404);
  });

  it('public profile: owner can view private profile (200)', async () => {
    const { accessToken, username } = await ctx.registerAndLogin();

    await ctx
      .patch(`${ctx.usersBase}/me`, accessToken)
      .send({ isProfilePublic: false })
      .expect(200);

    const res = await ctx.get(`${ctx.usersBase}/${username}`, accessToken).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe(username);
  });

  it('public profile: admin can view private profile (200)', async () => {
    await ctx.usersRepo.create({
      email: 'private-admin@example.com',
      username: 'private_admin_user',
      passwordHash: 'hash',
      isProfilePublic: false,
      showRatings: false,
      showWatchHistory: false,
    } as any);

    const adminToken = await ctx.makeAccessToken({
      sub: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
    });

    const res = await ctx.get(`${ctx.usersBase}/private_admin_user`, adminToken).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe('private_admin_user');
  });
});
