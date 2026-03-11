import * as fc from 'fast-check';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { ConsumeCodeFailureReason } from '../domain/repositories/exchange-codes.repository.interface';

describe('AuthService - Exchange Code Property Tests', () => {
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
    exchangeCodePepper: 'test-pepper-min-32-characters-long',
    stateSecret: 'test-state-secret',
    frontendUrl: 'http://localhost:3000',
  };

  let service: AuthService;

  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
    role: 'user',
  };

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

    // Default mock for token issuance
    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    passwordHasher.hash.mockResolvedValue('refresh-hash');
    refreshTokensRepository.issue.mockResolvedValue({ id: 'jti' });
  });

  describe('Property 4: Atomic One-Time Code Exchange', () => {
    // Arbitrary for exchange codes (base64url encoded)
    const exchangeCodeArb = fc.base64String({ minLength: 32, maxLength: 64 });

    it('should succeed exactly once for valid code', async () => {
      await fc.assert(
        fc.asyncProperty(exchangeCodeArb, async (code) => {
          jest.clearAllMocks();

          // Setup: first call succeeds, subsequent calls fail with ALREADY_USED
          let consumed = false;
          exchangeCodesRepository.consumeCode.mockImplementation(async () => {
            if (!consumed) {
              consumed = true;
              return { success: true, record: { userId: mockUser.id } };
            }
            return { success: false, reason: ConsumeCodeFailureReason.ALREADY_USED };
          });

          usersService.getById.mockResolvedValue(mockUser);
          (jwtService.signAsync as jest.Mock)
            .mockResolvedValueOnce('access-token-1')
            .mockResolvedValueOnce('refresh-token-1')
            .mockResolvedValueOnce('access-token-2')
            .mockResolvedValueOnce('refresh-token-2');
          passwordHasher.hash.mockResolvedValue('refresh-hash');
          refreshTokensRepository.issue.mockResolvedValue({ id: 'jti' });

          // First exchange should succeed
          const result = await service.exchangeCodeForTokens(code);
          expect(result).toHaveProperty('accessToken');
          expect(result).toHaveProperty('refreshToken');

          // Second exchange should fail with OAUTH_EXCHANGE_USED
          await expect(service.exchangeCodeForTokens(code)).rejects.toThrow(UnauthorizedException);
          await expect(service.exchangeCodeForTokens(code)).rejects.toThrow('OAUTH_EXCHANGE_USED');
        }),
        { numRuns: 50 },
      );
    });

    it('should fail with OAUTH_EXCHANGE_EXPIRED for expired codes', async () => {
      await fc.assert(
        fc.asyncProperty(exchangeCodeArb, async (code) => {
          jest.clearAllMocks();

          exchangeCodesRepository.consumeCode.mockResolvedValue({
            success: false,
            reason: ConsumeCodeFailureReason.EXPIRED,
          });

          await expect(service.exchangeCodeForTokens(code)).rejects.toThrow(UnauthorizedException);
          await expect(service.exchangeCodeForTokens(code)).rejects.toThrow(
            'OAUTH_EXCHANGE_EXPIRED',
          );
        }),
        { numRuns: 50 },
      );
    });

    it('should fail with OAUTH_EXCHANGE_EXPIRED for not found codes', async () => {
      await fc.assert(
        fc.asyncProperty(exchangeCodeArb, async (code) => {
          jest.clearAllMocks();

          exchangeCodesRepository.consumeCode.mockResolvedValue({
            success: false,
            reason: ConsumeCodeFailureReason.NOT_FOUND,
          });

          await expect(service.exchangeCodeForTokens(code)).rejects.toThrow(UnauthorizedException);
          await expect(service.exchangeCodeForTokens(code)).rejects.toThrow(
            'OAUTH_EXCHANGE_EXPIRED',
          );
        }),
        { numRuns: 50 },
      );
    });

    it('should distinguish between ALREADY_USED and EXPIRED errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          exchangeCodeArb,
          fc.constantFrom('already_used', 'expired', 'not_found') as fc.Arbitrary<
            'already_used' | 'expired' | 'not_found'
          >,
          async (code, failureReason) => {
            jest.clearAllMocks();

            exchangeCodesRepository.consumeCode.mockResolvedValue({
              success: false,
              reason: failureReason,
            });

            try {
              await service.exchangeCodeForTokens(code);
              // Should not reach here
              expect(true).toBe(false);
            } catch (error) {
              expect(error).toBeInstanceOf(UnauthorizedException);

              if (failureReason === 'already_used') {
                expect((error as UnauthorizedException).message).toBe('OAUTH_EXCHANGE_USED');
              } else {
                // Both 'expired' and 'not_found' return OAUTH_EXCHANGE_EXPIRED
                expect((error as UnauthorizedException).message).toBe('OAUTH_EXCHANGE_EXPIRED');
              }
            }
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should always hash the code before lookup', async () => {
      await fc.assert(
        fc.asyncProperty(exchangeCodeArb, async (code) => {
          jest.clearAllMocks();

          exchangeCodesRepository.consumeCode.mockResolvedValue({
            success: false,
            reason: ConsumeCodeFailureReason.NOT_FOUND,
          });

          try {
            await service.exchangeCodeForTokens(code);
          } catch {
            // Expected to fail
          }

          // Verify consumeCode was called with a hash, not the raw code
          expect(exchangeCodesRepository.consumeCode).toHaveBeenCalledTimes(1);
          const calledWith = exchangeCodesRepository.consumeCode.mock.calls[0][0];

          // Hash should be hex string (64 chars for SHA256)
          expect(calledWith).toMatch(/^[a-f0-9]{64}$/);
          // Hash should NOT be the raw code
          expect(calledWith).not.toBe(code);
        }),
        { numRuns: 50 },
      );
    });
  });
});
