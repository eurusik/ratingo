import { UsersE2eContext, createUsersApp } from './_harness';

describe('Users avatar upload (presigned) e2e', () => {
  let ctx: UsersE2eContext;

  beforeAll(async () => {
    ctx = await createUsersApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('POST /users/me/avatar/upload-url: returns presigned url and allows setting avatarUrl', async () => {
    const { accessToken } = await ctx.registerAndLogin();

    const meRes = await ctx.get(`${ctx.usersBase}/me`, accessToken).expect(200);
    expect(meRes.body.success).toBe(true);
    const userId = meRes.body.data.id as string;

    const res = await ctx
      .post(`${ctx.usersBase}/me/avatar/upload-url`, accessToken)
      .send({ contentType: 'image/png' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.key).toContain(`avatars/${userId}/`);
    expect(res.body.data.publicUrl).toBe(`https://cdn.example.com/${res.body.data.key}`);
    expect(res.body.data.uploadUrl).toBe(
      `https://uploads.example.com/signed-put?key=${encodeURIComponent(res.body.data.key)}`,
    );

    const patchRes = await ctx
      .patch(`${ctx.usersBase}/me`, accessToken)
      .send({ avatarUrl: res.body.data.publicUrl })
      .expect(200);

    expect(patchRes.body.success).toBe(true);
    expect(patchRes.body.data.avatarUrl).toBe(res.body.data.publicUrl);
  });

  it('POST /users/me/avatar/upload-url: requires auth', async () => {
    await ctx
      .post(`${ctx.usersBase}/me/avatar/upload-url`)
      .send({ contentType: 'image/png' })
      .expect(401);
  });

  it('POST /users/me/avatar/upload-url: validates contentType', async () => {
    const { accessToken } = await ctx.registerAndLogin();

    await ctx
      .post(`${ctx.usersBase}/me/avatar/upload-url`, accessToken)
      .send({ contentType: 'image/gif' })
      .expect(400);
  });
});
