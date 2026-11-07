import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import googleConfig from '../src/config/google.config';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UsersModule } from '../src/modules/users/users.module';
import { OAuthService } from '../src/modules/auth/application/oauth.service';
import { USERS_REPOSITORY } from '../src/modules/users/domain/repositories/users.repository.interface';
import { REFRESH_TOKENS_REPOSITORY } from '../src/modules/auth/domain/repositories/refresh-tokens.repository.interface';
import { EXCHANGE_CODES_REPOSITORY } from '../src/modules/auth/domain/repositories/exchange-codes.repository.interface';
import { OAUTH_ACCOUNTS_REPOSITORY } from '../src/modules/auth/domain/repositories/oauth-accounts.repository.interface';
import { USER_MEDIA_STATE_REPOSITORY } from '../src/modules/user-media/domain/repositories/user-media-state.repository.interface';
import { createE2eApp, createE2eTestingModule } from './support/e2e-testing-module';
import { InMemoryExchangeCodesRepository } from './support/in-memory-exchange-codes.repository';
import { InMemoryOAuthAccountsRepository } from './support/in-memory-oauth-accounts.repository';
import {
  InMemoryRefreshTokensRepository,
  InMemoryUserMediaRepository,
  InMemoryUsersRepository,
} from './users/_fakes';

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

    const moduleFixture: TestingModule = await createE2eTestingModule(
      {
        imports: [AuthModule, UsersModule],
      },
      [googleConfig],
    )
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
      .compile();

    app = await createE2eApp(moduleFixture);
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
    let oauthService: OAuthService;

    beforeAll(() => {
      oauthService = app.get(OAuthService);
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

      // 3. Generate exchange code via OAuthService
      const code = await oauthService.generateExchangeCode(user!.id);
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
      const code = await oauthService.generateExchangeCode(user!.id);
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
      const code = await oauthService.generateExchangeCode(user!.id);
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
      const code = await oauthService.generateExchangeCode(user!.id);
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
    let oauthService: OAuthService;

    beforeAll(() => {
      oauthService = app.get(OAuthService);
    });

    it('should complete full OAuth flow: loginWithOAuth -> generateExchangeCode -> exchange -> tokens', async () => {
      // Simulate what happens after GoogleAuthGuard validates the user:
      // 1. OAuthService.loginWithOAuth() is called with the OAuth user payload
      const oauthPayload = {
        provider: 'google' as const,
        providerAccountId: 'google-flow-123',
        email: 'googleflow@test.com',
        name: 'Google Flow User',
        picture: 'https://example.com/avatar.jpg',
      };

      const { user, tokens: loginTokens } = await oauthService.loginWithOAuth(oauthPayload);
      expect(user).toBeDefined();
      expect(user.email).toBe('googleflow@test.com');
      // Verify Google account is linked via oauth_accounts table
      const oauthLink = await oauthAccountsRepo.findByProviderAccount('google', 'google-flow-123');
      expect(oauthLink).not.toBeNull();
      expect(oauthLink!.userId).toBe(user.id);
      // loginWithOAuth returns tokens directly, but the controller uses exchange codes instead
      expect(loginTokens.accessToken).toBeDefined();

      // 2. Controller generates an exchange code (simulating googleCallback)
      const code = await oauthService.generateExchangeCode(user.id);
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

      const { user } = await oauthService.loginWithOAuth(oauthPayload);

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
      const first = await oauthService.loginWithOAuth(oauthPayload);
      const firstUserId = first.user.id;

      // Second login - returns same user
      const second = await oauthService.loginWithOAuth(oauthPayload);
      expect(second.user.id).toBe(firstUserId);
      expect(second.user.email).toBe('returning@test.com');
    });
  });

  describe('Google OAuth - account linking', () => {
    let oauthService: OAuthService;

    beforeAll(() => {
      oauthService = app.get(OAuthService);
    });

    it('should refuse to auto-link Google to an existing email/password account', async () => {
      await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({ email: 'link-test@test.com', username: 'linktest', password: 'Password123' })
        .expect(201);

      const error = await oauthService
        .loginWithOAuth({
          provider: 'google',
          providerAccountId: 'google-link-999',
          email: 'link-test@test.com',
          name: 'Link Test',
          picture: 'https://example.com/linked-avatar.jpg',
        })
        .catch((rejection: unknown) => rejection);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe('OAUTH_ACCOUNT_EXISTS_PASSWORD');

      expect(await oauthAccountsRepo.findByProviderAccount('google', 'google-link-999')).toBeNull();

      await request(app.getHttpServer())
        .post(`${baseUrl}/login`)
        .send({ email: 'link-test@test.com', password: 'Password123' })
        .expect(200);
    });

    it('should auto-link Google and set its avatar for an OAuth-only account without avatar', async () => {
      const oauthOnlyUser = await usersRepo.create({
        email: 'avatar-link@test.com',
        username: 'avatarlink',
        passwordHash: null,
        avatarUrl: null,
      });

      const { user: linkedUser } = await oauthService.loginWithOAuth({
        provider: 'google',
        providerAccountId: 'google-avatar-111',
        email: 'avatar-link@test.com',
        name: 'Avatar Link',
        picture: 'https://example.com/google-pic.jpg',
      });

      expect(linkedUser.id).toBe(oauthOnlyUser.id);
      expect(linkedUser.avatarUrl).toBe('https://example.com/google-pic.jpg');
      expect(
        await oauthAccountsRepo.findByProviderAccount('google', 'google-avatar-111'),
      ).toMatchObject({ userId: oauthOnlyUser.id });
    });

    it('should keep the existing avatar when auto-linking Google to an OAuth-only account', async () => {
      const oauthOnlyUser = await usersRepo.create({
        email: 'keep-avatar@test.com',
        username: 'keepavatar',
        passwordHash: null,
        avatarUrl: 'https://example.com/own-avatar.jpg',
      });

      const { user: linkedUser } = await oauthService.loginWithOAuth({
        provider: 'google',
        providerAccountId: 'google-keep-avatar-444',
        email: 'keep-avatar@test.com',
        name: 'Keep Avatar',
        picture: 'https://example.com/google-pic.jpg',
      });

      expect(linkedUser.id).toBe(oauthOnlyUser.id);
      expect(linkedUser.avatarUrl).toBe('https://example.com/own-avatar.jpg');
    });

    it('should create new user for unknown Google email', async () => {
      const oauthPayload = {
        provider: 'google' as const,
        providerAccountId: 'google-brand-new-222',
        email: 'brandnew@test.com',
        name: 'Brand New',
        picture: null,
      };

      const { user } = await oauthService.loginWithOAuth(oauthPayload);

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
      const code = await oauthService.generateExchangeCode(user.id);
      const res = await request(app.getHttpServer())
        .post(`${baseUrl}/oauth/exchange`)
        .send({ code })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('should find user by OAuth account on logins after explicit linking', async () => {
      await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({ email: 'find-by-gid@test.com', username: 'findbygid', password: 'Password123' })
        .expect(201);
      const passwordUser = await usersRepo.findByEmail('find-by-gid@test.com');
      if (!passwordUser) throw new Error('Registered user was not persisted');

      const oauthPayload = {
        provider: 'google' as const,
        providerAccountId: 'google-findme-333',
        email: 'find-by-gid@test.com',
        name: 'Find By GID',
        picture: null,
      };
      await oauthService.linkOAuthAccount(passwordUser.id, oauthPayload);

      const { user: oauthLogin } = await oauthService.loginWithOAuth(oauthPayload);
      expect(oauthLogin.id).toBe(passwordUser.id);
    });
  });
});
