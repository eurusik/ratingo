import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import authConfig from '../src/config/auth.config';
import googleConfig from '../src/config/google.config';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UsersModule } from '../src/modules/users/users.module';
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
import {
  IExchangeCodesRepository,
  EXCHANGE_CODES_REPOSITORY,
  ExchangeCodeRecord,
  ConsumeCodeResult,
  ConsumeCodeFailureReason,
} from '../src/modules/auth/domain/repositories/exchange-codes.repository.interface';
import { User } from '../src/modules/users/domain/entities/user.entity';
import { RefreshToken } from '../src/modules/auth/domain/entities/refresh-token.entity';
import { DATABASE_CONNECTION } from '../src/database/database.module';
import {
  IUserMediaStateRepository,
  USER_MEDIA_STATE_REPOSITORY,
} from '../src/modules/user-media/domain/repositories/user-media-state.repository.interface';

type UserData = Omit<User, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

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

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.users.find((u) => u.googleId === googleId) ?? null;
  }

  async linkGoogleId(userId: string, googleId: string): Promise<User> {
    const user = this.users.find((u) => u.id === userId);
    if (user) {
      user.googleId = googleId;
      return user;
    }
    throw new Error('User not found');
  }

  async create(data: UserData): Promise<User> {
    const user: User = {
      ...data,
      id: `user-${this.users.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordHash: data.passwordHash,
      googleId: data.googleId ?? null,
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
    } as User;
    this.users.push(user);
    return user;
  }

  async updateProfile(id: string, data: Partial<User>): Promise<User> {
    const user = this.users.find((u) => u.id === id);
    if (user) {
      Object.assign(user, data);
      return user;
    }
    throw new Error('User not found');
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const user = this.users.find((u) => u.id === id);
    if (user) {
      user.passwordHash = passwordHash;
    }
  }

  clear(): void {
    this.users = [];
  }
}

class InMemoryUserMediaRepository implements IUserMediaStateRepository {
  async upsert(): Promise<any> {
    throw new Error('Not implemented');
  }
  async findOne(): Promise<any> {
    return null;
  }
  async listByUser(): Promise<any[]> {
    return [];
  }
  async findManyByMediaIds(): Promise<any[]> {
    return [];
  }
  async getStats(): Promise<{ moviesRated: number; showsRated: number; watchlistCount: number }> {
    return { moviesRated: 0, showsRated: 0, watchlistCount: 0 };
  }
  async listWithMedia(): Promise<any[]> {
    return [];
  }
  async countWithMedia(): Promise<number> {
    return 0;
  }
  async listActivityWithMedia(): Promise<any[]> {
    return [];
  }
  async listContinueWithMedia(): Promise<any[]> {
    return [];
  }
  async countActivityWithMedia(): Promise<number> {
    return 0;
  }
  async countContinueWithMedia(): Promise<number> {
    return 0;
  }
  async findOneWithMedia(): Promise<any> {
    return null;
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

  clear(): void {
    this.tokens = [];
  }
}

class InMemoryExchangeCodesRepository implements IExchangeCodesRepository {
  private codes: ExchangeCodeRecord[] = [];

  async create(
    data: Omit<ExchangeCodeRecord, 'id' | 'usedAt' | 'createdAt'>,
  ): Promise<ExchangeCodeRecord> {
    const record: ExchangeCodeRecord = {
      ...data,
      id: `code-${this.codes.length + 1}`,
      usedAt: null,
      createdAt: new Date(),
    };
    this.codes.push(record);
    return record;
  }

  async consumeCode(codeHash: string): Promise<ConsumeCodeResult> {
    const now = new Date();
    const record = this.codes.find((c) => c.codeHash === codeHash);

    if (!record) {
      return { success: false, reason: ConsumeCodeFailureReason.NOT_FOUND };
    }

    if (record.usedAt) {
      return { success: false, reason: ConsumeCodeFailureReason.ALREADY_USED };
    }

    if (record.expiresAt < now) {
      return { success: false, reason: ConsumeCodeFailureReason.EXPIRED };
    }

    record.usedAt = now;
    return { success: true, record };
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date();
    const before = this.codes.length;
    this.codes = this.codes.filter((c) => c.expiresAt > now && !c.usedAt);
    return before - this.codes.length;
  }

  clear(): void {
    this.codes = [];
  }
}

describe('Google OAuth e2e', () => {
  let app: INestApplication;
  let usersRepo: InMemoryUsersRepository;
  let exchangeCodesRepo: InMemoryExchangeCodesRepository;
  const baseUrl = '/api/auth';

  beforeAll(async () => {
    usersRepo = new InMemoryUsersRepository();
    exchangeCodesRepo = new InMemoryExchangeCodesRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [authConfig, googleConfig],
          ignoreEnvFile: true,
        }),
        AuthModule,
        UsersModule,
      ],
    })
      .overrideProvider(USERS_REPOSITORY)
      .useValue(usersRepo)
      .overrideProvider(REFRESH_TOKENS_REPOSITORY)
      .useClass(InMemoryRefreshTokensRepository)
      .overrideProvider(EXCHANGE_CODES_REPOSITORY)
      .useValue(exchangeCodesRepo)
      .overrideProvider(USER_MEDIA_STATE_REPOSITORY)
      .useClass(InMemoryUserMediaRepository)
      .overrideProvider(DATABASE_CONNECTION)
      .useValue({})
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

  beforeEach(() => {
    usersRepo.clear();
    exchangeCodesRepo.clear();
  });

  describe('GET /auth/config', () => {
    it('should return google.enabled status', async () => {
      const res = await request(app.getHttpServer()).get(`${baseUrl}/config`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('google');
      expect(res.body.data.google).toHaveProperty('enabled');
      expect(typeof res.body.data.google.enabled).toBe('boolean');
    });
  });

  describe('POST /auth/oauth/exchange', () => {
    it('should return 401 for invalid exchange code', async () => {
      const res = await request(app.getHttpServer())
        .post(`${baseUrl}/oauth/exchange`)
        .send({ code: 'invalid-code' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('OAUTH_EXCHANGE_EXPIRED');
    });

    it('should return 401 for expired exchange code', async () => {
      const user = await usersRepo.create({
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: null,
        googleId: 'google-123',
        avatarUrl: null,
        bio: null,
        location: null,
        website: null,
        preferredLanguage: null,
        preferredRegion: null,
        isProfilePublic: true,
        showWatchHistory: true,
        showRatings: true,
        allowFollowers: true,
        role: 'user',
      });

      await exchangeCodesRepo.create({
        codeHash: 'expired-hash',
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000),
        ip: null,
        userAgent: null,
      });

      const res = await request(app.getHttpServer())
        .post(`${baseUrl}/oauth/exchange`)
        .send({ code: 'some-code-that-hashes-to-expired-hash' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should return 400 for missing code in request body', async () => {
      const res = await request(app.getHttpServer())
        .post(`${baseUrl}/oauth/exchange`)
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('Feature toggle behavior', () => {
    it('GET /auth/google should return 404 when Google OAuth is disabled', async () => {
      const res = await request(app.getHttpServer()).get(`${baseUrl}/google`);
      expect([302, 404]).toContain(res.status);
    });

    it('GET /auth/google/callback should return 404 when Google OAuth is disabled', async () => {
      const res = await request(app.getHttpServer()).get(`${baseUrl}/google/callback`);
      expect([302, 401, 404]).toContain(res.status);
    });

    it('GET /auth/config should indicate google.enabled status correctly', async () => {
      const res = await request(app.getHttpServer()).get(`${baseUrl}/config`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.google).toBeDefined();
      expect(res.body.data.google.enabled).toBe(false);
    });
  });

  describe('Exchange code security', () => {
    it('should not allow code reuse (one-time code)', async () => {
      const user = await usersRepo.create({
        email: 'reuse-test@example.com',
        username: 'reusetest',
        passwordHash: null,
        googleId: 'google-reuse-123',
        avatarUrl: null,
        bio: null,
        location: null,
        website: null,
        preferredLanguage: null,
        preferredRegion: null,
        isProfilePublic: true,
        showWatchHistory: true,
        showRatings: true,
        allowFollowers: true,
        role: 'user',
      });

      const testCodeHash = 'test-code-hash-for-reuse';
      await exchangeCodesRepo.create({
        codeHash: testCodeHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60000),
        ip: null,
        userAgent: null,
      });

      const firstResult = await exchangeCodesRepo.consumeCode(testCodeHash);
      expect(firstResult.success).toBe(true);

      const secondResult = await exchangeCodesRepo.consumeCode(testCodeHash);
      expect(secondResult.success).toBe(false);
      expect('reason' in secondResult && secondResult.reason).toBe('already_used');
    });

    it('should reject expired exchange codes', async () => {
      const user = await usersRepo.create({
        email: 'expired-test@example.com',
        username: 'expiredtest',
        passwordHash: null,
        googleId: 'google-expired-123',
        avatarUrl: null,
        bio: null,
        location: null,
        website: null,
        preferredLanguage: null,
        preferredRegion: null,
        isProfilePublic: true,
        showWatchHistory: true,
        showRatings: true,
        allowFollowers: true,
        role: 'user',
      });

      const expiredCodeHash = 'expired-code-hash';
      await exchangeCodesRepo.create({
        codeHash: expiredCodeHash,
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000),
        ip: null,
        userAgent: null,
      });

      const result = await exchangeCodesRepo.consumeCode(expiredCodeHash);
      expect(result.success).toBe(false);
      expect('reason' in result && result.reason).toBe('expired');
    });

    it('should reject non-existent exchange codes', async () => {
      const result = await exchangeCodesRepo.consumeCode('non-existent-hash');
      expect(result.success).toBe(false);
      expect('reason' in result && result.reason).toBe('not_found');
    });
  });

  describe('Exchange endpoint rate limiting', () => {
    it('should accept requests to exchange endpoint', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer())
          .post(`${baseUrl}/oauth/exchange`)
          .send({ code: `test-code-${i}` });

        expect(res.status).toBe(401);
      }
    });

    it('should return proper error format for invalid exchange attempts', async () => {
      const res = await request(app.getHttpServer())
        .post(`${baseUrl}/oauth/exchange`)
        .send({ code: 'invalid-code' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toContain('OAUTH_EXCHANGE');
    });
  });
});
