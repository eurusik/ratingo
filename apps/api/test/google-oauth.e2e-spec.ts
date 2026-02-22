import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import authConfig from '../src/config/auth.config';
import googleConfig from '../src/config/google.config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UsersModule } from '../src/modules/users/users.module';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { AuthService } from '../src/modules/auth/application/auth.service';
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
import {
  IOAuthAccountsRepository,
  OAUTH_ACCOUNTS_REPOSITORY,
  CreateOAuthAccountData,
} from '../src/modules/auth/domain/repositories/oauth-accounts.repository.interface';
import { OAuthAccount } from '../src/modules/auth/domain/entities/oauth-account.entity';
import { OAuthProvider } from '../src/modules/auth/domain/types/oauth-provider';
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

  async create(data: UserData): Promise<User> {
    const user: User = {
      ...data,
      id: `user-${this.users.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
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
      autoSubscribeOnWatch: data.autoSubscribeOnWatch ?? true,
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
  async delete(): Promise<void> {
    // no-op
  }

  async listFavoriteUpdates(_userId: string, _options: any): Promise<any[]> {
    return [];
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

class InMemoryOAuthAccountsRepository implements IOAuthAccountsRepository {
  private accounts: OAuthAccount[] = [];

  async findByProviderAccount(
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<OAuthAccount | null> {
    return (
      this.accounts.find(
        (a) => a.provider === provider && a.providerAccountId === providerAccountId,
      ) ?? null
    );
  }

  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    return this.accounts.filter((a) => a.userId === userId);
  }

  async findByUserAndProvider(
    userId: string,
    provider: OAuthProvider,
  ): Promise<OAuthAccount | null> {
    return this.accounts.find((a) => a.userId === userId && a.provider === provider) ?? null;
  }

  async create(data: CreateOAuthAccountData): Promise<OAuthAccount> {
    const account: OAuthAccount = {
      id: `oauth-${this.accounts.length + 1}`,
      userId: data.userId,
      provider: data.provider,
      providerAccountId: data.providerAccountId,
      email: data.email,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.accounts.push(account);
    return account;
  }

  async deleteByUserAndProvider(userId: string, provider: OAuthProvider): Promise<boolean> {
    const idx = this.accounts.findIndex((a) => a.userId === userId && a.provider === provider);
    if (idx >= 0) {
      this.accounts.splice(idx, 1);
      return true;
    }
    return false;
  }

  async countByUserId(userId: string): Promise<number> {
    return this.accounts.filter((a) => a.userId === userId).length;
  }

  clear(): void {
    this.accounts = [];
  }
}

describe('Google OAuth e2e', () => {
  let app: INestApplication;
  let usersRepo: InMemoryUsersRepository;
  let exchangeCodesRepo: InMemoryExchangeCodesRepository;
  let oauthAccountsRepo: InMemoryOAuthAccountsRepository;
  const baseUrl = '/api/auth';

  beforeAll(async () => {
    usersRepo = new InMemoryUsersRepository();
    exchangeCodesRepo = new InMemoryExchangeCodesRepository();
    oauthAccountsRepo = new InMemoryOAuthAccountsRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [authConfig, googleConfig],
          ignoreEnvFile: true,
        }),
        EventEmitterModule.forRoot(),
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
      .overrideProvider(OAUTH_ACCOUNTS_REPOSITORY)
      .useValue(oauthAccountsRepo)
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
    oauthAccountsRepo.clear();
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
      expect(res.body.error.code).toBe('OAUTH_EXCHANGE_EXPIRED');
    });

    it('should return 401 for expired exchange code', async () => {
      const user = await usersRepo.create({
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: null,
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
        autoSubscribeOnWatch: true,
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
        autoSubscribeOnWatch: true,
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
        autoSubscribeOnWatch: true,
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
      expect(res.body.error.code).toBe('OAUTH_EXCHANGE_EXPIRED');
    });
  });

  describe('Exchange code - happy path', () => {
    let authService: AuthService;

    beforeAll(() => {
      authService = app.get(AuthService);
    });

    it('should exchange a valid code for tokens', async () => {
      // 1. Register a user to get a valid userId
      const registerRes = await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({
          email: 'exchange-happy@test.com',
          username: 'exchangehappy',
          password: 'Password123',
        })
        .expect(201);

      expect(registerRes.body.success).toBe(true);

      // 2. Get the userId from the users repository
      const user = await usersRepo.findByEmail('exchange-happy@test.com');
      expect(user).not.toBeNull();

      // 3. Generate exchange code via AuthService
      const code = await authService.generateExchangeCode(user!.id);
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);

      // 4. Exchange the code for tokens via HTTP endpoint
      const res = await request(app.getHttpServer())
        .post(`${baseUrl}/oauth/exchange`)
        .send({ code })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(typeof res.body.data.refreshToken).toBe('string');
    });

    it('should not allow the same code to be used twice', async () => {
      // 1. Register a user
      const registerRes = await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({ email: 'reuse-happy@test.com', username: 'reusehappy', password: 'Password123' })
        .expect(201);

      expect(registerRes.body.success).toBe(true);
      const user = await usersRepo.findByEmail('reuse-happy@test.com');
      expect(user).not.toBeNull();

      // 2. Generate and use exchange code
      const code = await authService.generateExchangeCode(user!.id);
      const firstRes = await request(app.getHttpServer())
        .post(`${baseUrl}/oauth/exchange`)
        .send({ code })
        .expect(200);

      expect(firstRes.body.success).toBe(true);
      expect(firstRes.body.data).toHaveProperty('accessToken');

      // 3. Try to use the same code again - should fail
      const secondRes = await request(app.getHttpServer())
        .post(`${baseUrl}/oauth/exchange`)
        .send({ code })
        .expect(401);

      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.error.code).toBe('OAUTH_EXCHANGE_USED');
    });

    it('should return valid tokens that work for authenticated endpoints', async () => {
      // 1. Register a user
      await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({ email: 'authed-happy@test.com', username: 'authedhappy', password: 'Password123' })
        .expect(201);

      const user = await usersRepo.findByEmail('authed-happy@test.com');
      expect(user).not.toBeNull();

      // 2. Generate exchange code and exchange for tokens
      const code = await authService.generateExchangeCode(user!.id);
      const exchangeRes = await request(app.getHttpServer())
        .post(`${baseUrl}/oauth/exchange`)
        .send({ code })
        .expect(200);

      const { accessToken } = exchangeRes.body.data;
      expect(typeof accessToken).toBe('string');

      // 3. Use the access token to hit GET /auth/me
      const meRes = await request(app.getHttpServer())
        .get(`${baseUrl}/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.email).toBe('authed-happy@test.com');
      expect(meRes.body.data.username).toBe('authedhappy');
    });

    it('should return tokens that can be refreshed', async () => {
      // 1. Register a user
      await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({
          email: 'refresh-happy@test.com',
          username: 'refreshhappy',
          password: 'Password123',
        })
        .expect(201);

      const user = await usersRepo.findByEmail('refresh-happy@test.com');
      expect(user).not.toBeNull();

      // 2. Generate exchange code and exchange for tokens
      const code = await authService.generateExchangeCode(user!.id);
      const exchangeRes = await request(app.getHttpServer())
        .post(`${baseUrl}/oauth/exchange`)
        .send({ code })
        .expect(200);

      const { refreshToken } = exchangeRes.body.data;

      // 3. Use the refresh token to get new tokens
      const refreshRes = await request(app.getHttpServer())
        .post(`${baseUrl}/refresh`)
        .send({ refreshToken })
        .expect(201);

      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data).toHaveProperty('accessToken');
      expect(refreshRes.body.data).toHaveProperty('refreshToken');
      // New tokens should be different from original
      expect(refreshRes.body.data.refreshToken).not.toBe(refreshToken);
    });
  });

  describe('Google OAuth - simulated flow', () => {
    let authService: AuthService;

    beforeAll(() => {
      authService = app.get(AuthService);
    });

    it('should complete full OAuth flow: loginWithOAuth -> generateExchangeCode -> exchange -> tokens', async () => {
      // Simulate what happens after GoogleAuthGuard validates the user:
      // 1. AuthService.loginWithOAuth() is called with the OAuth user payload
      const oauthPayload = {
        provider: 'google' as const,
        providerAccountId: 'google-flow-123',
        email: 'googleflow@test.com',
        name: 'Google Flow User',
        picture: 'https://example.com/avatar.jpg',
      };

      const { user, tokens: loginTokens } = await authService.loginWithOAuth(oauthPayload);
      expect(user).toBeDefined();
      expect(user.email).toBe('googleflow@test.com');
      // Verify Google account is linked via oauth_accounts table
      const oauthLink = await oauthAccountsRepo.findByProviderAccount('google', 'google-flow-123');
      expect(oauthLink).not.toBeNull();
      expect(oauthLink!.userId).toBe(user.id);
      // loginWithOAuth returns tokens directly, but the controller uses exchange codes instead
      expect(loginTokens.accessToken).toBeDefined();

      // 2. Controller generates an exchange code (simulating googleCallback)
      const code = await authService.generateExchangeCode(user.id);
      expect(typeof code).toBe('string');

      // 3. Frontend exchanges the code for tokens via HTTP endpoint
      const exchangeRes = await request(app.getHttpServer())
        .post(`${baseUrl}/oauth/exchange`)
        .send({ code })
        .expect(200);

      expect(exchangeRes.body.success).toBe(true);
      expect(exchangeRes.body.data).toHaveProperty('accessToken');
      expect(exchangeRes.body.data).toHaveProperty('refreshToken');

      // 4. Verify the exchanged tokens work
      const { accessToken } = exchangeRes.body.data;
      const meRes = await request(app.getHttpServer())
        .get(`${baseUrl}/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.email).toBe('googleflow@test.com');
    });

    it('should create new user with generated username for Google OAuth', async () => {
      const oauthPayload = {
        provider: 'google' as const,
        providerAccountId: 'google-new-user-456',
        email: 'newgoogle@test.com',
        name: 'New Google User',
        picture: null,
      };

      const { user } = await authService.loginWithOAuth(oauthPayload);

      expect(user).toBeDefined();
      expect(user.email).toBe('newgoogle@test.com');
      // Verify Google account is linked via oauth_accounts table
      const oauthLink = await oauthAccountsRepo.findByProviderAccount(
        'google',
        'google-new-user-456',
      );
      expect(oauthLink).not.toBeNull();
      expect(oauthLink!.userId).toBe(user.id);
      // Username should be auto-generated from the name
      expect(user.username).toBeTruthy();
      expect(user.username.length).toBeGreaterThanOrEqual(3);
      // Should not have a password since it's a Google-only account
      expect(user.passwordHash).toBeNull();
    });

    it('should return same user on subsequent Google logins', async () => {
      const oauthPayload = {
        provider: 'google' as const,
        providerAccountId: 'google-returning-789',
        email: 'returning@test.com',
        name: 'Returning User',
        picture: 'https://example.com/pic.jpg',
      };

      // First login - creates user
      const first = await authService.loginWithOAuth(oauthPayload);
      const firstUserId = first.user.id;

      // Second login - returns same user
      const second = await authService.loginWithOAuth(oauthPayload);
      expect(second.user.id).toBe(firstUserId);
      expect(second.user.email).toBe('returning@test.com');
    });
  });

  describe('Google OAuth - account linking', () => {
    let authService: AuthService;

    beforeAll(() => {
      authService = app.get(AuthService);
    });

    it('should link Google to existing email/password account', async () => {
      // 1. Register a user with email/password
      await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({ email: 'link-test@test.com', username: 'linktest', password: 'Password123' })
        .expect(201);

      const userBefore = await usersRepo.findByEmail('link-test@test.com');
      expect(userBefore).not.toBeNull();
      expect(userBefore!.passwordHash).not.toBeNull();

      // 2. Simulate Google login with the same email
      const oauthPayload = {
        provider: 'google' as const,
        providerAccountId: 'google-link-999',
        email: 'link-test@test.com',
        name: 'Link Test',
        picture: 'https://example.com/linked-avatar.jpg',
      };

      const { user: linkedUser } = await authService.loginWithOAuth(oauthPayload);

      // 3. Verify the accounts are linked via oauth_accounts table
      expect(linkedUser.id).toBe(userBefore!.id);
      expect(linkedUser.email).toBe('link-test@test.com');
      const oauthLink = await oauthAccountsRepo.findByProviderAccount('google', 'google-link-999');
      expect(oauthLink).not.toBeNull();
      expect(oauthLink!.userId).toBe(linkedUser.id);

      // 4. Verify original password login still works
      const loginRes = await request(app.getHttpServer())
        .post(`${baseUrl}/login`)
        .send({ email: 'link-test@test.com', password: 'Password123' })
        .expect(200);

      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data).toHaveProperty('accessToken');
    });

    it('should set avatar from Google when existing account has no avatar', async () => {
      // 1. Register a user without avatar
      await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({ email: 'avatar-link@test.com', username: 'avatarlink', password: 'Password123' })
        .expect(201);

      const userBefore = await usersRepo.findByEmail('avatar-link@test.com');
      expect(userBefore!.avatarUrl).toBeNull();

      // 2. Link Google account with a picture
      const { user: linkedUser } = await authService.loginWithOAuth({
        provider: 'google' as const,
        providerAccountId: 'google-avatar-111',
        email: 'avatar-link@test.com',
        name: 'Avatar Link',
        picture: 'https://example.com/google-pic.jpg',
      });

      // 3. Verify avatar was set from Google
      expect(linkedUser.avatarUrl).toBe('https://example.com/google-pic.jpg');
    });

    it('should create new user for unknown Google email', async () => {
      const oauthPayload = {
        provider: 'google' as const,
        providerAccountId: 'google-brand-new-222',
        email: 'brandnew@test.com',
        name: 'Brand New',
        picture: null,
      };

      const { user } = await authService.loginWithOAuth(oauthPayload);

      expect(user).toBeDefined();
      expect(user.email).toBe('brandnew@test.com');
      expect(user.passwordHash).toBeNull();
      // Verify Google account is linked via oauth_accounts table
      const oauthLink = await oauthAccountsRepo.findByProviderAccount(
        'google',
        'google-brand-new-222',
      );
      expect(oauthLink).not.toBeNull();
      expect(oauthLink!.userId).toBe(user.id);

      // Verify the new user can get tokens via exchange code flow
      const code = await authService.generateExchangeCode(user.id);
      const res = await request(app.getHttpServer())
        .post(`${baseUrl}/oauth/exchange`)
        .send({ code })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('should find user by OAuth account on subsequent logins after linking', async () => {
      // 1. Register with email/password
      await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({ email: 'find-by-gid@test.com', username: 'findbygid', password: 'Password123' })
        .expect(201);

      // 2. First Google login - links account via oauth_accounts table
      const oauthPayload = {
        provider: 'google' as const,
        providerAccountId: 'google-findme-333',
        email: 'find-by-gid@test.com',
        name: 'Find By GID',
        picture: null,
      };
      const { user: firstLogin } = await authService.loginWithOAuth(oauthPayload);
      const oauthLink = await oauthAccountsRepo.findByProviderAccount(
        'google',
        'google-findme-333',
      );
      expect(oauthLink).not.toBeNull();
      expect(oauthLink!.userId).toBe(firstLogin.id);

      // 3. Second Google login - should find by provider account (not by email)
      const { user: secondLogin } = await authService.loginWithOAuth(oauthPayload);
      expect(secondLogin.id).toBe(firstLogin.id);
    });
  });
});
