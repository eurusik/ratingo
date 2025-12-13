import { UsersE2eContext, createUsersApp } from './_harness';

describe('Users public watchlist/history e2e', () => {
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

  it('public watchlist/history: visibility respects showWatchHistory and profile privacy', async () => {
    const user = await ctx.usersRepo.create({
      email: 'watch@example.com',
      username: 'watch_user',
      passwordHash: 'hash',
      isProfilePublic: true,
      showWatchHistory: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm2',
      state: 'planned',
      rating: null,
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm3',
      state: 'watching',
      rating: null,
    });

    const wlRes = await ctx.get(`${ctx.usersBase}/watch_user/watchlist`).expect(200);
    expect(wlRes.body.data).toHaveLength(1);

    const histRes = await ctx.get(`${ctx.usersBase}/watch_user/history`).expect(200);
    expect(histRes.body.data).toHaveLength(1);

    await ctx.usersRepo.updateProfile(user.id, { showWatchHistory: false });
    await ctx.get(`${ctx.usersBase}/watch_user/history`).expect(404);

    await ctx.usersRepo.updateProfile(user.id, { isProfilePublic: false });
    await ctx.get(`${ctx.usersBase}/watch_user/watchlist`).expect(404);
  });

  it('public watchlist/history: owner can view when showWatchHistory=false and profile is private', async () => {
    const user = await ctx.usersRepo.create({
      email: 'watch-owner@example.com',
      username: 'watch_owner',
      passwordHash: 'hash',
      isProfilePublic: false,
      showWatchHistory: false,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm2',
      state: 'planned',
      rating: null,
      progress: { seasons: { 1: 1 } },
      notes: 'secret-notes',
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm3',
      state: 'watching',
      rating: null,
      progress: { seasons: { 1: 2 } },
      notes: 'secret-notes-2',
    });

    const ownerToken = await ctx.makeAccessToken({
      sub: user.id,
      email: user.email,
      role: 'user',
    });

    await ctx.get(`${ctx.usersBase}/watch_owner/watchlist`, ownerToken).expect(200);
    await ctx.get(`${ctx.usersBase}/watch_owner/history`, ownerToken).expect(200);
  });

  it('public watchlist/history: admin can view when hidden', async () => {
    const user = await ctx.usersRepo.create({
      email: 'watch-admin@example.com',
      username: 'watch_admin_target',
      passwordHash: 'hash',
      isProfilePublic: false,
      showWatchHistory: false,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm2',
      state: 'planned',
      rating: null,
      progress: { seasons: { 1: 1 } },
      notes: 'secret-notes',
    });

    const adminToken = await ctx.makeAccessToken({
      sub: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
    });

    await ctx.get(`${ctx.usersBase}/watch_admin_target/watchlist`, adminToken).expect(200);
  });

  it('public watchlist: progress and notes are hidden for guest, visible for owner', async () => {
    const user = await ctx.usersRepo.create({
      email: 'watch-hide@example.com',
      username: 'watch_hide',
      passwordHash: 'hash',
      isProfilePublic: true,
      showWatchHistory: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm2',
      state: 'planned',
      rating: null,
      progress: { seasons: { 1: 1 } },
      notes: 'secret-notes',
    });

    const guestRes = await ctx.get(`${ctx.usersBase}/watch_hide/watchlist`).expect(200);
    expect(guestRes.body.data[0].progress).toBeNull();
    expect(guestRes.body.data[0].notes).toBeNull();

    const ownerToken = await ctx.makeAccessToken({
      sub: user.id,
      email: user.email,
      role: 'user',
    });

    const ownerRes = await ctx.get(`${ctx.usersBase}/watch_hide/watchlist`, ownerToken).expect(200);
    expect(ownerRes.body.data[0].progress).toEqual({ seasons: { 1: 1 } });
    expect(ownerRes.body.data[0].notes).toBe('secret-notes');
  });

  it('public watchlist/history: rejects unknown query params (forbidNonWhitelisted)', async () => {
    const user = await ctx.usersRepo.create({
      email: 'watch-q@example.com',
      username: 'watch_q',
      passwordHash: 'hash',
      isProfilePublic: true,
      showWatchHistory: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm2',
      state: 'planned',
      rating: null,
    });

    await ctx.get(`${ctx.usersBase}/watch_q/watchlist?unknown=1`).expect(400);
    await ctx.get(`${ctx.usersBase}/watch_q/history?unknown=1`).expect(400);
  });

  it('public watchlist: paginates with limit/offset', async () => {
    const user = await ctx.usersRepo.create({
      email: 'watch-page@example.com',
      username: 'watch_page',
      passwordHash: 'hash',
      isProfilePublic: true,
      showWatchHistory: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'planned',
      rating: null,
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm2',
      state: 'planned',
      rating: null,
      updatedAt: new Date('2020-01-02T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm3',
      state: 'planned',
      rating: null,
      updatedAt: new Date('2020-01-03T00:00:00.000Z'),
    });

    // default sort=recent => m3, m2, m1
    const res = await ctx.get(`${ctx.usersBase}/watch_page/watchlist?limit=1&offset=1`).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].mediaSummary.id).toBe('m2');
  });

  it('public history: paginates with limit/offset', async () => {
    const user = await ctx.usersRepo.create({
      email: 'history-page@example.com',
      username: 'history_page',
      passwordHash: 'hash',
      isProfilePublic: true,
      showWatchHistory: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'watching',
      rating: null,
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm2',
      state: 'completed',
      rating: null,
      updatedAt: new Date('2020-01-02T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm3',
      state: 'watching',
      rating: null,
      updatedAt: new Date('2020-01-03T00:00:00.000Z'),
    });

    // default sort=recent => m3, m2, m1
    const res = await ctx.get(`${ctx.usersBase}/history_page/history?limit=1&offset=1`).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].mediaSummary.id).toBe('m2');
  });

  it('public watchlist/history: validates pagination params (limit/offset)', async () => {
    const user = await ctx.usersRepo.create({
      email: 'watch-validate@example.com',
      username: 'watch_validate',
      passwordHash: 'hash',
      isProfilePublic: true,
      showWatchHistory: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'planned',
      rating: null,
    });

    await ctx.get(`${ctx.usersBase}/watch_validate/watchlist?limit=0`).expect(400);
    await ctx.get(`${ctx.usersBase}/watch_validate/watchlist?limit=101`).expect(400);
    await ctx.get(`${ctx.usersBase}/watch_validate/watchlist?offset=-1`).expect(400);

    await ctx.get(`${ctx.usersBase}/watch_validate/history?limit=0`).expect(400);
    await ctx.get(`${ctx.usersBase}/watch_validate/history?limit=101`).expect(400);
    await ctx.get(`${ctx.usersBase}/watch_validate/history?offset=-1`).expect(400);
  });

  it('public watchlist: sorts by recent (updatedAt desc)', async () => {
    const user = await ctx.usersRepo.create({
      email: 'watch-sort-recent@example.com',
      username: 'watch_sort_recent',
      passwordHash: 'hash',
      isProfilePublic: true,
      showWatchHistory: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'planned',
      rating: null,
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm2',
      state: 'planned',
      rating: null,
      updatedAt: new Date('2020-01-03T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm3',
      state: 'planned',
      rating: null,
      updatedAt: new Date('2020-01-02T00:00:00.000Z'),
    });

    const res = await ctx
      .get(`${ctx.usersBase}/watch_sort_recent/watchlist?sort=recent`)
      .expect(200);
    expect(res.body.data.map((i: any) => i.mediaSummary.id)).toEqual(['m2', 'm3', 'm1']);
  });

  it('public watchlist: sorts by releaseDate (releaseDate desc)', async () => {
    const user = await ctx.usersRepo.create({
      email: 'watch-sort-release@example.com',
      username: 'watch_sort_release',
      passwordHash: 'hash',
      isProfilePublic: true,
      showWatchHistory: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'planned',
      rating: null,
      releaseDate: new Date('2010-01-01T00:00:00.000Z'),
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm2',
      state: 'planned',
      rating: null,
      releaseDate: new Date('2012-01-01T00:00:00.000Z'),
      updatedAt: new Date('2020-01-02T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm3',
      state: 'planned',
      rating: null,
      releaseDate: new Date('2011-01-01T00:00:00.000Z'),
      updatedAt: new Date('2020-01-03T00:00:00.000Z'),
    });

    const res = await ctx
      .get(`${ctx.usersBase}/watch_sort_release/watchlist?sort=releaseDate`)
      .expect(200);
    expect(res.body.data.map((i: any) => i.mediaSummary.id)).toEqual(['m2', 'm3', 'm1']);
  });

  it('public history: sorts by recent (updatedAt desc)', async () => {
    const user = await ctx.usersRepo.create({
      email: 'history-sort-recent@example.com',
      username: 'history_sort_recent',
      passwordHash: 'hash',
      isProfilePublic: true,
      showWatchHistory: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'watching',
      rating: null,
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm2',
      state: 'completed',
      rating: null,
      updatedAt: new Date('2020-01-03T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm3',
      state: 'watching',
      rating: null,
      updatedAt: new Date('2020-01-02T00:00:00.000Z'),
    });

    const res = await ctx
      .get(`${ctx.usersBase}/history_sort_recent/history?sort=recent`)
      .expect(200);
    expect(res.body.data.map((i: any) => i.mediaSummary.id)).toEqual(['m2', 'm3', 'm1']);
  });

  it('public history: sorts by releaseDate (releaseDate desc)', async () => {
    const user = await ctx.usersRepo.create({
      email: 'history-sort-release@example.com',
      username: 'history_sort_release',
      passwordHash: 'hash',
      isProfilePublic: true,
      showWatchHistory: true,
    } as any);

    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm1',
      state: 'watching',
      rating: null,
      releaseDate: new Date('2010-01-01T00:00:00.000Z'),
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm2',
      state: 'completed',
      rating: null,
      releaseDate: new Date('2012-01-01T00:00:00.000Z'),
      updatedAt: new Date('2020-01-02T00:00:00.000Z'),
    });
    await ctx.userMediaRepo.upsert({
      userId: user.id,
      mediaItemId: 'm3',
      state: 'watching',
      rating: null,
      releaseDate: new Date('2011-01-01T00:00:00.000Z'),
      updatedAt: new Date('2020-01-03T00:00:00.000Z'),
    });

    const res = await ctx
      .get(`${ctx.usersBase}/history_sort_release/history?sort=releaseDate`)
      .expect(200);
    expect(res.body.data.map((i: any) => i.mediaSummary.id)).toEqual(['m2', 'm3', 'm1']);
  });
});
