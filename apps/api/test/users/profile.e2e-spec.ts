import { UsersE2eContext, createUsersApp } from './_harness';

describe('Users profile e2e', () => {
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

  it('update profile: full payload updates and strips passwordHash', async () => {
    const { accessToken } = await ctx.registerAndLogin();

    const payload = {
      username: 'newname',
      avatarUrl: 'https://example.com/avatar.png',
      bio: 'Hello',
      location: 'Earth',
      website: 'https://example.com',
      preferredLanguage: 'en',
      preferredRegion: 'US',
      isProfilePublic: false,
      showWatchHistory: false,
      showRatings: false,
      allowFollowers: false,
    };

    const res = await ctx.patch(`${ctx.usersBase}/me`, accessToken).send(payload).expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe('newname');
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.body.data.isProfilePublic).toBe(false);
  });

  it('update profile: partial payload does not overwrite unspecified fields', async () => {
    const { accessToken } = await ctx.registerAndLogin();

    await ctx
      .patch(`${ctx.usersBase}/me`, accessToken)
      .send({ bio: 'first', location: 'Kyiv', isProfilePublic: true })
      .expect(200);

    const res = await ctx
      .patch(`${ctx.usersBase}/me`, accessToken)
      .send({ location: 'Lviv' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.location).toBe('Lviv');
    expect(res.body.data.bio).toBe('first');
  });

  it('update profile: validation fails on bad payload and 401 without auth', async () => {
    await ctx.patch(`${ctx.usersBase}/me`).send({ website: 'not-a-url' }).expect(401);

    const { accessToken } = await ctx.registerAndLogin();

    await ctx
      .patch(`${ctx.usersBase}/me`, accessToken)
      .send({ username: 'ab', showRatings: 'yes' })
      .expect(400);
  });

  it('update profile: rejects unknown body fields (forbidNonWhitelisted)', async () => {
    const { accessToken } = await ctx.registerAndLogin();

    await ctx.patch(`${ctx.usersBase}/me`, accessToken).send({ unknownField: 'x' }).expect(400);
  });
});
