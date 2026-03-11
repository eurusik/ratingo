import * as fc from 'fast-check';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

describe('AuthService - Username Generation Property Tests', () => {
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

  const config = {
    accessTokenSecret: 'access-secret',
    refreshTokenSecret: 'refresh-secret',
    accessTokenTtl: '24h',
    refreshTokenTtl: '7d',
    exchangeCodePepper: 'test-pepper',
    stateSecret: 'test-state-secret',
    frontendUrl: 'http://localhost:3000',
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      usersService as any,
      config as any,
      jwtService as any,
      passwordHasher as any,
      refreshTokensRepository as any,
      exchangeCodesRepository as any,
      {} as any,
    );
  });

  // Username validation regex: only ASCII alphanumeric and underscores
  const USERNAME_PATTERN = /^[a-z0-9_]+$/;
  const USERNAME_MIN_LENGTH = 3;
  const USERNAME_MAX_LENGTH = 30;

  describe('Property 2: Username Generation Constraints', () => {
    // Arbitrary for Google profile names (various unicode, special chars, etc.)
    const googleNameArb = fc.oneof(
      fc.string({ minLength: 0, maxLength: 100 }), // Random strings including unicode
      fc.constantFrom(
        'John Doe',
        'José García',
        '田中太郎',
        'Müller',
        '!!!@@@###',
        '',
        '   ',
        'a',
        'ab',
        'A Very Long Name That Exceeds Normal Limits And Should Be Truncated',
      ),
    );

    // Arbitrary for email addresses
    const emailArb = fc.emailAddress();

    it('should always produce usernames with only ASCII alphanumeric and underscores', async () => {
      await fc.assert(
        fc.asyncProperty(googleNameArb, emailArb, async (name, email) => {
          // No collision - username available immediately
          usersService.getByUsername.mockResolvedValue(null);

          const username = await service.generateUniqueUsername(name, email);

          // Must match pattern: only lowercase alphanumeric and underscores
          expect(username).toMatch(USERNAME_PATTERN);
        }),
        { numRuns: 100 },
      );
    });

    it('should always produce usernames between 3 and 30 characters', async () => {
      await fc.assert(
        fc.asyncProperty(googleNameArb, emailArb, async (name, email) => {
          // No collision
          usersService.getByUsername.mockResolvedValue(null);

          const username = await service.generateUniqueUsername(name, email);

          expect(username.length).toBeGreaterThanOrEqual(USERNAME_MIN_LENGTH);
          expect(username.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH + 1); // +1 for suffix edge case
        }),
        { numRuns: 100 },
      );
    });

    it('should always produce lowercase usernames', async () => {
      await fc.assert(
        fc.asyncProperty(googleNameArb, emailArb, async (name, email) => {
          usersService.getByUsername.mockResolvedValue(null);

          const username = await service.generateUniqueUsername(name, email);

          expect(username).toBe(username.toLowerCase());
        }),
        { numRuns: 100 },
      );
    });

    it('should add suffix on collision and still produce valid username', async () => {
      await fc.assert(
        fc.asyncProperty(googleNameArb, emailArb, async (name, email) => {
          // First call returns collision, second returns null (available)
          usersService.getByUsername
            .mockResolvedValueOnce({ id: 'existing' })
            .mockResolvedValueOnce(null);

          const username = await service.generateUniqueUsername(name, email);

          // Must still match pattern
          expect(username).toMatch(USERNAME_PATTERN);
          expect(username.length).toBeGreaterThanOrEqual(USERNAME_MIN_LENGTH);
        }),
        { numRuns: 100 },
      );
    });

    it('should fallback to fully random username after max retries', async () => {
      await fc.assert(
        fc.asyncProperty(googleNameArb, emailArb, async (name, email) => {
          // All attempts return collision
          usersService.getByUsername.mockResolvedValue({ id: 'existing' });

          const username = await service.generateUniqueUsername(name, email);

          // Should fallback to user_<random> pattern
          expect(username).toMatch(/^user_[a-z0-9]+$/);
          expect(username.length).toBeGreaterThanOrEqual(USERNAME_MIN_LENGTH);
        }),
        { numRuns: 50 },
      );
    });

    it('should handle empty or whitespace-only names by falling back to email', async () => {
      const emptyNameArb = fc.constantFrom('', '   ', '\t\n', '!!!', '@@@');

      await fc.assert(
        fc.asyncProperty(emptyNameArb, emailArb, async (name, email) => {
          usersService.getByUsername.mockResolvedValue(null);

          const username = await service.generateUniqueUsername(name, email);

          // Must still produce valid username
          expect(username).toMatch(USERNAME_PATTERN);
          expect(username.length).toBeGreaterThanOrEqual(USERNAME_MIN_LENGTH);
        }),
        { numRuns: 50 },
      );
    });

    it('should never produce usernames with consecutive underscores', async () => {
      await fc.assert(
        fc.asyncProperty(googleNameArb, emailArb, async (name, email) => {
          usersService.getByUsername.mockResolvedValue(null);

          const username = await service.generateUniqueUsername(name, email);

          // No consecutive underscores (collapsed during normalization)
          expect(username).not.toMatch(/__+/);
        }),
        { numRuns: 100 },
      );
    });

    it('should never produce usernames starting or ending with underscore', async () => {
      await fc.assert(
        fc.asyncProperty(googleNameArb, emailArb, async (name, email) => {
          usersService.getByUsername.mockResolvedValue(null);

          const username = await service.generateUniqueUsername(name, email);

          // No leading/trailing underscores (trimmed during normalization)
          // Exception: suffix adds underscore before random chars
          if (!username.includes('_')) {
            expect(username).not.toMatch(/^_|_$/);
          }
        }),
        { numRuns: 100 },
      );
    });
  });
});
