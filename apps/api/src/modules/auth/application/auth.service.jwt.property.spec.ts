import * as fc from 'fast-check';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

describe('AuthService - JWT Payload Consistency Property Tests', () => {
  // Mock dependencies
  const usersService = {
    getByEmail: jest.fn(),
    getByUsername: jest.fn(),
    createUser: jest.fn(),
    getById: jest.fn(),
    updatePassword: jest.fn(),
    updateProfile: jest.fn(),
  };

  const jwtService: Pick<JwtService, 'signAsync' | 'verifyAsync'> = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as any;

  const passwordHasher = {
    hash: jest.fn(),
    compare: jest.fn(),
  };

  const refreshTokensRepository = {
    issue: jest.fn(),
    findById: jest.fn(),
    findValidByUser: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  const exchangeCodesRepository = {
    create: jest.fn(),
    consumeCode: jest.fn(),
    cleanupExpired: jest.fn(),
  };

  const oauthAccountsRepository = {
    findByProviderAccount: jest.fn(),
    findByUserId: jest.fn(),
    findByUserAndProvider: jest.fn(),
    create: jest.fn(),
    deleteByUserAndProvider: jest.fn(),
    countByUserId: jest.fn(),
  };

  const config = {
    accessTokenSecret: 'access-secret',
    refreshTokenSecret: 'refresh-secret',
    accessTokenTtl: '15m',
    refreshTokenTtl: '7d',
    exchangeCodePepper: 'test-pepper-min-32-characters-long',
    stateSecret: 'test-state-secret',
    frontendUrl: 'http://localhost:3000',
  };

  let service: AuthService;

  // Track JWT payloads for comparison
  let capturedAccessPayloads: Array<{ sub: string; email: string; role: string }> = [];

  beforeEach(() => {
    jest.clearAllMocks();
    capturedAccessPayloads = [];

    // Capture JWT payloads when signAsync is called
    (jwtService.signAsync as jest.Mock).mockImplementation(async (payload, options) => {
      if (options?.secret === config.accessTokenSecret) {
        capturedAccessPayloads.push({ ...payload });
        return `access-token-${capturedAccessPayloads.length}`;
      }
      return `refresh-token-${Date.now()}`;
    });

    passwordHasher.hash.mockResolvedValue('hashed-password');
    passwordHasher.compare.mockResolvedValue(true);
    refreshTokensRepository.issue.mockResolvedValue({ id: 'jti' });

    service = new AuthService(
      usersService as any,
      config as any,
      jwtService as any,
      passwordHasher as any,
      refreshTokensRepository as any,
      exchangeCodesRepository as any,
      oauthAccountsRepository as any,
    );
  });

  describe('Property 5: JWT Payload Consistency', () => {
    // Arbitrary for user data
    const userIdArb = fc.uuid();
    const emailArb = fc.emailAddress();
    const roleArb = fc.constantFrom('user', 'admin');
    const usernameArb = fc.stringMatching(/^[a-z][a-z0-9_]{2,19}$/);

    it('should issue tokens with same payload structure for OAuth and password auth', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          emailArb,
          roleArb,
          usernameArb,
          async (userId, email, role, username) => {
            jest.clearAllMocks();
            capturedAccessPayloads = [];

            const user = {
              id: userId,
              email,
              role,
              username,
              passwordHash: 'hashed-password',
              avatarUrl: null,
            };

            // Setup mocks for password login
            usersService.getByEmail.mockResolvedValue(user);
            passwordHasher.compare.mockResolvedValue(true);

            // Password login
            await service.login(email, 'password123');
            const passwordPayload = capturedAccessPayloads[0];

            // Reset for OAuth login
            capturedAccessPayloads = [];
            oauthAccountsRepository.findByProviderAccount.mockResolvedValue({
              userId,
              provider: 'google',
              providerAccountId: 'google-123',
            });
            usersService.getById.mockResolvedValue(user);

            // OAuth login
            await service.loginWithOAuth({
              provider: 'google',
              providerAccountId: 'google-123',
              email,
              name: 'Test User',
              picture: null,
            });
            const oauthPayload = capturedAccessPayloads[0];

            // Both payloads should have the same structure
            expect(passwordPayload).toHaveProperty('sub');
            expect(passwordPayload).toHaveProperty('email');
            expect(passwordPayload).toHaveProperty('role');

            expect(oauthPayload).toHaveProperty('sub');
            expect(oauthPayload).toHaveProperty('email');
            expect(oauthPayload).toHaveProperty('role');

            // Values should match for the same user
            expect(oauthPayload.sub).toBe(passwordPayload.sub);
            expect(oauthPayload.email).toBe(passwordPayload.email);
            expect(oauthPayload.role).toBe(passwordPayload.role);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should always include sub, email, and role in access token payload', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, emailArb, roleArb, async (userId, email, role) => {
          jest.clearAllMocks();
          capturedAccessPayloads = [];

          const user = {
            id: userId,
            email,
            role,
            username: 'testuser',
            passwordHash: null,
            avatarUrl: null,
          };

          oauthAccountsRepository.findByProviderAccount.mockResolvedValue({
            userId,
            provider: 'google',
            providerAccountId: 'google-123',
          });
          usersService.getById.mockResolvedValue(user);

          await service.loginWithOAuth({
            provider: 'google',
            providerAccountId: 'google-123',
            email,
            name: 'Test User',
            picture: null,
          });

          const payload = capturedAccessPayloads[0];

          // Required fields must be present
          expect(payload).toHaveProperty('sub', userId);
          expect(payload).toHaveProperty('email', email);
          expect(payload).toHaveProperty('role', role);

          // No extra sensitive fields should be included
          expect(payload).not.toHaveProperty('password');
          expect(payload).not.toHaveProperty('passwordHash');
          expect(payload).not.toHaveProperty('providerAccountId');
        }),
        { numRuns: 50 },
      );
    });

    it('should use user.id as sub claim for all auth methods', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, emailArb, async (userId, email) => {
          jest.clearAllMocks();
          capturedAccessPayloads = [];

          const user = {
            id: userId,
            email,
            role: 'user',
            username: 'testuser',
            passwordHash: null,
            avatarUrl: null,
          };

          oauthAccountsRepository.findByProviderAccount.mockResolvedValue({
            userId,
            provider: 'google',
            providerAccountId: 'google-123',
          });
          usersService.getById.mockResolvedValue(user);

          await service.loginWithOAuth({
            provider: 'google',
            providerAccountId: 'google-123',
            email,
            name: 'Test User',
            picture: null,
          });

          const payload = capturedAccessPayloads[0];

          // sub should always be the user's ID
          expect(payload.sub).toBe(userId);
          // sub should be a valid UUID format
          expect(payload.sub).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          );
        }),
        { numRuns: 50 },
      );
    });

    it('should preserve email case in JWT payload', async () => {
      const mixedCaseEmailArb = fc
        .tuple(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9._%+-]{0,10}$/), fc.constant('@'), fc.domain())
        .map(([local, at, domain]) => `${local}${at}${domain}`);

      await fc.assert(
        fc.asyncProperty(userIdArb, mixedCaseEmailArb, async (userId, email) => {
          jest.clearAllMocks();
          capturedAccessPayloads = [];

          const user = {
            id: userId,
            email, // Preserve original case
            role: 'user',
            username: 'testuser',
            passwordHash: null,
            avatarUrl: null,
          };

          oauthAccountsRepository.findByProviderAccount.mockResolvedValue({
            userId,
            provider: 'google',
            providerAccountId: 'google-123',
          });
          usersService.getById.mockResolvedValue(user);

          await service.loginWithOAuth({
            provider: 'google',
            providerAccountId: 'google-123',
            email,
            name: 'Test User',
            picture: null,
          });

          const payload = capturedAccessPayloads[0];

          // Email in payload should match user's stored email exactly
          expect(payload.email).toBe(email);
        }),
        { numRuns: 50 },
      );
    });
  });
});
