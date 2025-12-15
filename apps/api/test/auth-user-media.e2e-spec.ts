import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import authConfig from '../src/config/auth.config';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UsersModule } from '../src/modules/users/users.module';
import { UserMediaModule } from '../src/modules/user-media/user-media.module';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import {
  USERS_REPOSITORY,
  IUsersRepository,
} from '../src/modules/users/domain/repositories/users.repository.interface';
import {
  IRefreshTokensRepository,
  REFRESH_TOKENS_REPOSITORY,
} from '../src/modules/auth/domain/repositories/refresh-tokens.repository.interface';
import { User } from '../src/modules/users/domain/entities/user.entity';
import { RefreshToken } from '../src/modules/auth/domain/entities/refresh-token.entity';
import { DATABASE_CONNECTION } from '../src/database/database.module';
import {
  IUserMediaStateRepository,
  USER_MEDIA_STATE_REPOSITORY,
  UpsertUserMediaStateData,
} from '../src/modules/user-media/domain/repositories/user-media-state.repository.interface';
import { UserMediaState } from '../src/modules/user-media/domain/entities/user-media-state.entity';
import { MediaType } from '../src/common/enums/media-type.enum';

type MediaSummary = {
  id: string;
  type: MediaType;
  title: string;
  slug: string;
  poster: null;
};

type MediaStateWithSummary = UserMediaState & { mediaSummary: MediaSummary };

class InMemoryUsersRepository implements IUsersRepository {
  private users: User[] = [];

  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.users.find((u) => u.username === username) ?? null;
  }

  async create(data: any): Promise<User> {
    const user: User = {
      id: `user-${this.users.length + 1}`,
      email: data.email,
      username: data.username,
      passwordHash: data.passwordHash,
      avatarUrl: data.avatarUrl ?? null,
      bio: data.bio ?? null,
      location: data.location ?? null,
      website: data.website ?? null,
      preferredLanguage: data.preferredLanguage ?? null,
      preferredRegion: data.preferredRegion ?? null,
      isProfilePublic: data.isProfilePublic ?? true,
      showWatchHistory: data.showWatchHistory ?? true,
      showRatings: data.showRatings ?? true,
      allowFollowers: data.allowFollowers ?? true,
      role: (data.role as User['role']) ?? 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.push(user);
    return user;
  }

  async updateProfile(): Promise<User> {
    throw new Error('Not implemented');
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const user = this.users.find((u) => u.id === id);
    if (user) {
      user.passwordHash = passwordHash;
    }
  }
}

class InMemoryRefreshTokensRepository implements IRefreshTokensRepository {
  private tokens: RefreshToken[] = [];

  async issue(token: Omit<RefreshToken, 'createdAt'>): Promise<RefreshToken> {
    const issued: RefreshToken = { ...token, createdAt: new Date() } as RefreshToken;
    this.tokens.push(issued);
    return issued;
  }

  async findById(id: string): Promise<RefreshToken | null> {
    return this.tokens.find((t) => t.id === id) ?? null;
  }

  async findValidByUser(userId: string): Promise<RefreshToken[]> {
    const now = new Date();
    return this.tokens.filter((t) => t.userId === userId && !t.revokedAt && t.expiresAt >= now);
  }

  async revoke(id: string): Promise<void> {
    const token = this.tokens.find((t) => t.id === id);
    if (token) token.revokedAt = new Date();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    this.tokens.forEach((t) => {
      if (t.userId === userId) t.revokedAt = new Date();
    });
  }
}

class InMemoryUserMediaRepository implements IUserMediaStateRepository {
  private states: MediaStateWithSummary[] = [];

  private makeSummary(mediaItemId: string): MediaSummary {
    return {
      id: mediaItemId,
      type: 'movie',
      title: `Title ${mediaItemId}`,
      slug: `slug-${mediaItemId}`,
      poster: null,
    } as MediaSummary;
  }

  async upsert(data: UpsertUserMediaStateData): Promise<UserMediaState> {
    const existing = this.states.find(
      (s) => s.userId === data.userId && s.mediaItemId === data.mediaItemId,
    );
    if (existing) {
      existing.state = data.state;
      existing.rating = data.rating ?? null;
      existing.progress = data.progress ?? null;
      existing.notes = data.notes ?? null;
      existing.updatedAt = new Date();
      return existing;
    }
    const created: MediaStateWithSummary = {
      id: `state-${this.states.length + 1}`,
      userId: data.userId,
      mediaItemId: data.mediaItemId,
      state: data.state,
      rating: data.rating ?? null,
      progress: data.progress ?? null,
      notes: data.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      mediaSummary: this.makeSummary(data.mediaItemId),
    };
    this.states.push(created);
    return created;
  }

  async findOne(userId: string, mediaItemId: string): Promise<UserMediaState | null> {
    return this.states.find((s) => s.userId === userId && s.mediaItemId === mediaItemId) ?? null;
  }

  async listByUser(userId: string, limit = 20, offset = 0): Promise<UserMediaState[]> {
    return this.states.filter((s) => s.userId === userId).slice(offset, offset + limit);
  }

  async findManyByMediaIds(userId: string, mediaItemIds: string[]): Promise<UserMediaState[]> {
    return this.states.filter((s) => s.userId === userId && mediaItemIds.includes(s.mediaItemId));
  }

  async listWithMedia(userId: string, limit = 20, offset = 0, options?: any) {
    let items = this.states.filter((s) => s.userId === userId);

    if (options?.ratedOnly) {
      items = items.filter((s) => s.rating !== null);
    }

    if (options?.states?.length) {
      items = items.filter((s) => options.states.includes(s.state));
    }

    return items.slice(offset, offset + limit);
  }

  async countWithMedia(userId: string, options?: any): Promise<number> {
    let items = this.states.filter((s) => s.userId === userId);

    if (options?.ratedOnly) {
      items = items.filter((s) => s.rating !== null);
    }

    if (options?.states?.length) {
      items = items.filter((s) => options.states.includes(s.state));
    }

    return items.length;
  }

  async listActivityWithMedia(userId: string, limit = 20, offset = 0): Promise<any[]> {
    let items = this.states.filter((s) => s.userId === userId);
    items = items.filter((s) => s.state === 'watching' || s.progress !== null);
    items = [...items].sort((a, b) => (b.updatedAt as any) - (a.updatedAt as any));
    return items.slice(offset, offset + limit);
  }

  async listContinueWithMedia(userId: string, limit = 20, offset = 0): Promise<any[]> {
    let items = this.states.filter((s) => s.userId === userId);
    items = items.filter((s) => s.progress !== null);
    items = [...items].sort((a, b) => (b.updatedAt as any) - (a.updatedAt as any));
    return items.slice(offset, offset + limit);
  }

  async countActivityWithMedia(userId: string): Promise<number> {
    return this.states.filter(
      (s) => s.userId === userId && (s.state === 'watching' || s.progress !== null),
    ).length;
  }

  async countContinueWithMedia(userId: string): Promise<number> {
    return this.states.filter((s) => s.userId === userId && s.progress !== null).length;
  }

  async getStats(userId: string) {
    const byUser = this.states.filter((s) => s.userId === userId);
    const rated = byUser.filter((s) => s.rating !== null);
    return {
      moviesRated: rated.filter((s) => s.mediaSummary.type === MediaType.MOVIE).length,
      showsRated: rated.filter((s) => s.mediaSummary.type === MediaType.SHOW).length,
      watchlistCount: byUser.filter((s) => s.state === 'planned').length,
    };
  }

  async findOneWithMedia(userId: string, mediaItemId: string) {
    return this.states.find((s) => s.userId === userId && s.mediaItemId === mediaItemId) ?? null;
  }
}

describe('User Media e2e', () => {
  let app: INestApplication;
  const baseUrl = '/api/auth';
  const mediaUrl = '/api/user-media';
  const registerAndLogin = async (suffix = '') => {
    const email = `media${suffix}${Date.now()}@example.com`;
    const username = `media${suffix}${Date.now()}`;
    const password = 'S3curePassw0rd';
    const reg = await request(app.getHttpServer())
      .post(`${baseUrl}/register`)
      .send({ email, username, password })
      .expect(201);
    return reg.body.data.accessToken as string;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [authConfig], ignoreEnvFile: true }),
        AuthModule,
        UsersModule,
        UserMediaModule,
      ],
    })
      .overrideProvider(USERS_REPOSITORY)
      .useClass(InMemoryUsersRepository)
      .overrideProvider(REFRESH_TOKENS_REPOSITORY)
      .useClass(InMemoryRefreshTokensRepository)
      .overrideProvider(DATABASE_CONNECTION)
      .useValue({})
      .overrideProvider(USER_MEDIA_STATE_REPOSITORY)
      .useClass(InMemoryUserMediaRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer())
      .patch(`${mediaUrl}/mid-unauth`)
      .send({ state: 'watching' })
      .expect(401);
    await request(app.getHttpServer()).get(`${mediaUrl}/mid-unauth`).expect(401);
    await request(app.getHttpServer()).get(`${mediaUrl}`).expect(401);
  });

  it('set/get/list with bearer', async () => {
    const token = await registerAndLogin();

    const mediaItemId = 'mid-1';

    const setRes = await request(app.getHttpServer())
      .patch(`${mediaUrl}/${mediaItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ state: 'watching', rating: 8 })
      .expect(200);
    expect(setRes.body.success).toBe(true);
    expect(setRes.body.data.state).toBe('watching');
    expect(setRes.body.data.mediaSummary.card).toBeDefined();
    expect(setRes.body.data.mediaSummary.card.badgeKey).toBeNull();
    expect(setRes.body.data.mediaSummary.card.primaryCta).toBe('OPEN');
    expect(setRes.body.data.mediaSummary.card.continue).toBeNull();

    const getRes = await request(app.getHttpServer())
      .get(`${mediaUrl}/${mediaItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.mediaSummary.id).toBe(mediaItemId);
    expect(getRes.body.data.mediaSummary.card).toBeDefined();
    expect(getRes.body.data.mediaSummary.card.primaryCta).toBe('OPEN');

    const listRes = await request(app.getHttpServer())
      .get(`${mediaUrl}?limit=10&offset=0`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThan(0);
    expect(listRes.body.data[0].mediaSummary.card).toBeDefined();
  });

  it('upsert updates existing state and supports nullable fields', async () => {
    const token = await registerAndLogin('upsert');
    const mediaItemId = 'mid-upsert';

    await request(app.getHttpServer())
      .patch(`${mediaUrl}/${mediaItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ state: 'watching', rating: 7, notes: 'first' })
      .expect(200);

    const second = await request(app.getHttpServer())
      .patch(`${mediaUrl}/${mediaItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ state: 'completed', rating: null, progress: null, notes: null })
      .expect(200);

    expect(second.body.data.state).toBe('completed');
    expect(second.body.data.rating).toBeNull();
    expect(second.body.data.notes).toBeNull();
  });

  it('returns CONTINUE badge when progress.seasons exists', async () => {
    const token = await registerAndLogin('continue');
    const mediaItemId = 'mid-continue';

    const res = await request(app.getHttpServer())
      .patch(`${mediaUrl}/${mediaItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ state: 'watching', progress: { seasons: { 1: 3 } } })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.mediaSummary.card).toBeDefined();
    expect(res.body.data.mediaSummary.card.badgeKey).toBe('CONTINUE');
    expect(res.body.data.mediaSummary.card.primaryCta).toBe('CONTINUE');
    expect(res.body.data.mediaSummary.card.continue).toEqual({ season: 1, episode: 3 });
  });

  it('auto-upgrades state to watching when progress is provided', async () => {
    const token = await registerAndLogin('progress-up');
    const mediaItemId = 'mid-progress-upgrade';

    const res = await request(app.getHttpServer())
      .patch(`${mediaUrl}/${mediaItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ state: 'planned', progress: { seasons: { 1: 2 } } })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.state).toBe('watching');
    expect(res.body.data.progress).toEqual({ seasons: { 1: 2 } });
  });

  it('rejects progress for completed/dropped states', async () => {
    const token = await registerAndLogin('progress-reject');

    await request(app.getHttpServer())
      .patch(`${mediaUrl}/mid-progress-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({ state: 'completed', progress: { seasons: { 1: 2 } } })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`${mediaUrl}/mid-progress-dropped`)
      .set('Authorization', `Bearer ${token}`)
      .send({ state: 'dropped', progress: { seasons: { 1: 2 } } })
      .expect(400);
  });

  it('pagination respects limit/offset', async () => {
    const token = await registerAndLogin('page');

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .patch(`${mediaUrl}/mid-page-${i}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ state: 'watching' })
        .expect(200);
    }

    const page1 = await request(app.getHttpServer())
      .get(`${mediaUrl}?limit=2&offset=0`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const page2 = await request(app.getHttpServer())
      .get(`${mediaUrl}?limit=2&offset=2`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(page1.body.data.length).toBe(2);
    expect(page2.body.data.length).toBe(2);
    expect(page1.body.data[0].mediaItemId).not.toBe(page2.body.data[0].mediaItemId);
  });

  it('lists continue items (progress only) and sets listContext=CONTINUE_LIST', async () => {
    const token = await registerAndLogin('continue-list');

    await request(app.getHttpServer())
      .patch(`${mediaUrl}/mid-continue-a`)
      .set('Authorization', `Bearer ${token}`)
      .send({ state: 'watching', progress: { seasons: { 1: 1 } } })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`${mediaUrl}/mid-continue-b`)
      .set('Authorization', `Bearer ${token}`)
      .send({ state: 'watching' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`${mediaUrl}/continue?limit=10&offset=0`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].progress).toEqual({ seasons: { 1: 1 } });
    expect(res.body.data[0].mediaSummary.card).toBeDefined();
    expect(res.body.data[0].mediaSummary.card.listContext).toBe('CONTINUE_LIST');
    expect(res.body.data[0].mediaSummary.card.badgeKey).toBe('CONTINUE');
    expect(res.body.data[0].mediaSummary.card.primaryCta).toBe('CONTINUE');
  });
});
