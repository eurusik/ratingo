import { UsersE2eContext, createUsersApp } from './_harness';

describe('Users password e2e', () => {
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

  it('change password: happy path and old password stops working', async () => {
    const { accessToken, email, password } = await ctx.registerAndLogin();
    const newPassword = 'Anoth3rS3cure';

    await ctx
      .patch(`${ctx.usersBase}/me/password`, accessToken)
      .send({ currentPassword: password, newPassword })
      .expect(204);

    await ctx.post(`${ctx.authBase}/login`).send({ email, password }).expect(401);

    await ctx.post(`${ctx.authBase}/login`).send({ email, password: newPassword }).expect(200);
  });

  it('change password: validation and 401 without auth', async () => {
    await ctx
      .patch(`${ctx.usersBase}/me/password`)
      .send({ currentPassword: 'a', newPassword: 'b' })
      .expect(401);

    const { accessToken } = await ctx.registerAndLogin();

    await ctx
      .patch(`${ctx.usersBase}/me/password`, accessToken)
      .send({ currentPassword: 'short', newPassword: 'short' })
      .expect(400);
  });

  it('change password: rejects unknown body fields (forbidNonWhitelisted)', async () => {
    const { accessToken, password } = await ctx.registerAndLogin();

    await ctx
      .patch(`${ctx.usersBase}/me/password`, accessToken)
      .send({ currentPassword: password, newPassword: 'Anoth3rS3cure', extra: true })
      .expect(400);
  });

  it('change password: rejects wrong currentPassword', async () => {
    const { accessToken } = await ctx.registerAndLogin();

    await ctx
      .patch(`${ctx.usersBase}/me/password`, accessToken)
      .send({ currentPassword: 'WrongPass123', newPassword: 'Anoth3rS3cure' })
      .expect(401);
  });
});
