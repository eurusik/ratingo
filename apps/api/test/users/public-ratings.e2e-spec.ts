import { UsersE2eContext, createUsersApp } from './_harness';

describe('Users public ratings e2e', () => {
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

  it('public ratings: guest sees public ratings, hidden when showRatings=false', async () => {
    const user = await ctx.usersRepo.create({
      email: 'ratings@example.com',
      username: 'ratings_user',
      passwordHash: 'hash',
      isProfilePublic: true,
      showRatings: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'completed',
      rating: 90,
    });

    const res = await ctx.get(`${ctx.usersBase}/ratings_user/ratings`).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);

    await ctx.usersRepo.updateProfile(user.id, { showRatings: false });
    await ctx.get(`${ctx.usersBase}/ratings_user/ratings`).expect(404);
  });

  it('public ratings: owner can view ratings even when showRatings=false', async () => {
    const user = await ctx.usersRepo.create({
      email: 'ratings-owner@example.com',
      username: 'ratings_owner',
      passwordHash: 'hash',
      isProfilePublic: true,
      showRatings: false,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'completed',
      rating: 90,
      progress: { seasons: { 1: 3 } },
      notes: 'secret-notes',
    });

    const ownerToken = await ctx.makeAccessToken({
      sub: user.id,
      email: user.email,
      role: 'user',
    });

    const res = await ctx.get(`${ctx.usersBase}/ratings_owner/ratings`, ownerToken).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('public ratings: admin can view ratings even when showRatings=false', async () => {
    const user = await ctx.usersRepo.create({
      email: 'ratings-admin@example.com',
      username: 'ratings_admin_target',
      passwordHash: 'hash',
      isProfilePublic: true,
      showRatings: false,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'completed',
      rating: 90,
      progress: { seasons: { 1: 3 } },
      notes: 'secret-notes',
    });

    const adminToken = await ctx.makeAccessToken({
      sub: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
    });

    const res = await ctx
      .get(`${ctx.usersBase}/ratings_admin_target/ratings`, adminToken)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('public ratings: progress and notes are hidden for guest, visible for owner', async () => {
    const user = await ctx.usersRepo.create({
      email: 'ratings-hide@example.com',
      username: 'ratings_hide',
      passwordHash: 'hash',
      isProfilePublic: true,
      showRatings: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'completed',
      rating: 90,
      progress: { seasons: { 1: 3 } },
      notes: 'secret-notes',
    });

    const guestRes = await ctx.get(`${ctx.usersBase}/ratings_hide/ratings`).expect(200);
    expect(guestRes.body.success).toBe(true);
    expect(guestRes.body.data[0].progress).toBeNull();
    expect(guestRes.body.data[0].notes).toBeNull();

    const ownerToken = await ctx.makeAccessToken({
      sub: user.id,
      email: user.email,
      role: 'user',
    });

    const ownerRes = await ctx.get(`${ctx.usersBase}/ratings_hide/ratings`, ownerToken).expect(200);
    expect(ownerRes.body.success).toBe(true);
    expect(ownerRes.body.data[0].progress).toEqual({ seasons: { 1: 3 } });
    expect(ownerRes.body.data[0].notes).toBe('secret-notes');
  });

  it('public ratings: rejects unknown query params (forbidNonWhitelisted)', async () => {
    const user = await ctx.usersRepo.create({
      email: 'ratings-q@example.com',
      username: 'ratings_q',
      passwordHash: 'hash',
      isProfilePublic: true,
      showRatings: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'completed',
      rating: 90,
    });

    await ctx.get(`${ctx.usersBase}/ratings_q/ratings?unknown=1`).expect(400);
  });

  it('public ratings: paginates with limit/offset', async () => {
    const user = await ctx.usersRepo.create({
      email: 'ratings-page@example.com',
      username: 'ratings_page',
      passwordHash: 'hash',
      isProfilePublic: true,
      showRatings: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'completed',
      rating: 10,
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm2',
      state: 'completed',
      rating: 20,
      updatedAt: new Date('2020-01-02T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm3',
      state: 'completed',
      rating: 30,
      updatedAt: new Date('2020-01-03T00:00:00.000Z'),
    });

    // default sort=recent => m3, m2, m1
    const res = await ctx.get(`${ctx.usersBase}/ratings_page/ratings?limit=1&offset=1`).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].mediaSummary.id).toBe('m2');
  });

  it('public ratings: validates pagination params (limit/offset)', async () => {
    const user = await ctx.usersRepo.create({
      email: 'ratings-validate@example.com',
      username: 'ratings_validate',
      passwordHash: 'hash',
      isProfilePublic: true,
      showRatings: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'completed',
      rating: 10,
    });

    await ctx.get(`${ctx.usersBase}/ratings_validate/ratings?limit=0`).expect(400);
    await ctx.get(`${ctx.usersBase}/ratings_validate/ratings?limit=101`).expect(400);
    await ctx.get(`${ctx.usersBase}/ratings_validate/ratings?offset=-1`).expect(400);
  });

  it('public ratings: sorts by recent (updatedAt desc)', async () => {
    const user = await ctx.usersRepo.create({
      email: 'ratings-sort-recent@example.com',
      username: 'ratings_sort_recent',
      passwordHash: 'hash',
      isProfilePublic: true,
      showRatings: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'completed',
      rating: 10,
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm2',
      state: 'completed',
      rating: 20,
      updatedAt: new Date('2020-01-03T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm3',
      state: 'completed',
      rating: 30,
      updatedAt: new Date('2020-01-02T00:00:00.000Z'),
    });

    const res = await ctx
      .get(`${ctx.usersBase}/ratings_sort_recent/ratings?sort=recent`)
      .expect(200);
    expect(res.body.data.map((i: any) => i.mediaSummary.id)).toEqual(['m2', 'm3', 'm1']);
  });

  it('public ratings: sorts by rating (rating desc, tie-breaker updatedAt)', async () => {
    const user = await ctx.usersRepo.create({
      email: 'ratings-sort-rating@example.com',
      username: 'ratings_sort_rating',
      passwordHash: 'hash',
      isProfilePublic: true,
      showRatings: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'completed',
      rating: 80,
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm2',
      state: 'completed',
      rating: 90,
      updatedAt: new Date('2020-01-02T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm3',
      state: 'completed',
      rating: 90,
      updatedAt: new Date('2020-01-03T00:00:00.000Z'),
    });

    const res = await ctx
      .get(`${ctx.usersBase}/ratings_sort_rating/ratings?sort=rating`)
      .expect(200);
    expect(res.body.data.map((i: any) => i.mediaSummary.id)).toEqual(['m3', 'm2', 'm1']);
  });

  it('public ratings: sorts by releaseDate (releaseDate desc)', async () => {
    const user = await ctx.usersRepo.create({
      email: 'ratings-sort-release@example.com',
      username: 'ratings_sort_release',
      passwordHash: 'hash',
      isProfilePublic: true,
      showRatings: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'completed',
      rating: 10,
      releaseDate: new Date('2010-01-01T00:00:00.000Z'),
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm2',
      state: 'completed',
      rating: 20,
      releaseDate: new Date('2012-01-01T00:00:00.000Z'),
      updatedAt: new Date('2020-01-02T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm3',
      state: 'completed',
      rating: 30,
      releaseDate: new Date('2011-01-01T00:00:00.000Z'),
      updatedAt: new Date('2020-01-03T00:00:00.000Z'),
    });

    const res = await ctx
      .get(`${ctx.usersBase}/ratings_sort_release/ratings?sort=releaseDate`)
      .expect(200);
    expect(res.body.data.map((i: any) => i.mediaSummary.id)).toEqual(['m2', 'm3', 'm1']);
  });
});
