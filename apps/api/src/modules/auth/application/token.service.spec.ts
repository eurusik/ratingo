import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';
import { type AuthMocks, createAuthMocks, createTokenService } from '../../../../test/auth/_mocks';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('TokenService', () => {
  let mocks: AuthMocks;
  let service: TokenService;

  beforeEach(() => {
    mocks = createAuthMocks();
    service = createTokenService(mocks);
  });

  it('issueTokens: should sign access/refresh tokens and persist hashed refresh token', async () => {
    const user = { id: 'u1', email: 'user@example.com', role: 'user' } as any;

    (mocks.jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    mocks.refreshTokensRepository.issue.mockResolvedValue({ id: 'jti' });

    const result = await service.issueTokens(user, { userAgent: 'test-agent', ip: '127.0.0.1' });

    // Access token payload
    expect(mocks.jwtService.signAsync).toHaveBeenNthCalledWith(
      1,
      { sub: 'u1', email: 'user@example.com', role: 'user' },
      { secret: mocks.config.accessTokenSecret, expiresIn: mocks.config.accessTokenTtl },
    );
    // Refresh token payload (jti is random)
    expect(mocks.jwtService.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sub: 'u1', type: 'refresh' }),
      { secret: mocks.config.refreshTokenSecret, expiresIn: mocks.config.refreshTokenTtl },
    );

    // Refresh token is hashed with SHA-256 (not bcrypt, which truncates at 72 bytes)
    expect(mocks.passwordHasher.hash).not.toHaveBeenCalled();
    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledTimes(1);
    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        tokenHash: sha256('refresh-token'),
        userAgent: 'test-agent',
        ip: '127.0.0.1',
        revokedAt: null,
      }),
    );

    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it('issueTokens: should store null userAgent/ip when clientMeta is absent', async () => {
    const user = { id: 'u2', email: 'other@example.com', role: 'admin' } as any;

    (mocks.jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('at')
      .mockResolvedValueOnce('rt');
    mocks.refreshTokensRepository.issue.mockResolvedValue({ id: 'j2' });

    await service.issueTokens(user);

    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u2',
        userAgent: null,
        ip: null,
      }),
    );
  });

  it('refresh: should reject invalid JWT', async () => {
    (mocks.jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error('invalid'));
    await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  const VALID_PAYLOAD = { sub: 'u1', jti: 'j1', type: 'refresh' };
  const activeRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'j1',
    userId: 'u1',
    tokenHash: sha256('token'),
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  });

  const arrangeSuccessfulRotation = () => {
    mocks.usersService.getById.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      role: 'user',
    });
    (mocks.jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('new-access')
      .mockResolvedValueOnce('new-refresh');
    mocks.refreshTokensRepository.issue.mockResolvedValue({ id: 'new-jti' });
    mocks.refreshTokensRepository.revokeIfActive.mockResolvedValue(true);
  };

  beforeEach(() => {
    (mocks.jwtService.verifyAsync as jest.Mock).mockResolvedValue(VALID_PAYLOAD);
  });

  it('refresh: should reject missing token without revoking anything', async () => {
    mocks.refreshTokensRepository.findById.mockResolvedValueOnce(null);

    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mocks.refreshTokensRepository.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('refresh: should reject expired token', async () => {
    mocks.refreshTokensRepository.findById.mockResolvedValueOnce(
      activeRow({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mocks.refreshTokensRepository.revokeIfActive).not.toHaveBeenCalled();
  });

  it('refresh: replaying a long-revoked token should revoke all sessions (reuse detection)', async () => {
    mocks.refreshTokensRepository.findById.mockResolvedValueOnce(
      activeRow({ revokedAt: new Date(Date.now() - 5 * 60_000) }),
    );

    await expect(service.refresh('token')).rejects.toThrow('Refresh token reuse detected');
    expect(mocks.refreshTokensRepository.revokeAllForUser).toHaveBeenCalledWith('u1');
    expect(mocks.refreshTokensRepository.issue).not.toHaveBeenCalled();
  });

  it('refresh: replaying a just-rotated token is rejected without revoking all sessions', async () => {
    mocks.refreshTokensRepository.findById.mockResolvedValueOnce(
      activeRow({ revokedAt: new Date(Date.now() - 2_000) }),
    );

    await expect(service.refresh('token')).rejects.toThrow('Refresh token expired or revoked');
    expect(mocks.refreshTokensRepository.revokeAllForUser).not.toHaveBeenCalled();
    expect(mocks.refreshTokensRepository.issue).not.toHaveBeenCalled();
  });

  it('refresh: should detect reuse (hash mismatch) and revoke all for user', async () => {
    mocks.refreshTokensRepository.findById.mockResolvedValue(
      activeRow({ tokenHash: sha256('some-other-token') }),
    );

    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mocks.refreshTokensRepository.revokeAllForUser).toHaveBeenCalledWith('u1');
    expect(mocks.refreshTokensRepository.revokeIfActive).not.toHaveBeenCalled();
  });

  it('refresh: should reject a stored hash of different length without throwing', async () => {
    mocks.refreshTokensRepository.findById.mockResolvedValue(activeRow({ tokenHash: 'short' }));

    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mocks.refreshTokensRepository.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('refresh: should rotate token on success (SHA-256 hash)', async () => {
    mocks.refreshTokensRepository.findById.mockResolvedValue(activeRow());
    arrangeSuccessfulRotation();

    const result = await service.refresh('token');

    expect(mocks.passwordHasher.compare).not.toHaveBeenCalled();
    expect(mocks.refreshTokensRepository.revokeIfActive).toHaveBeenCalledWith('j1');
    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledTimes(1);
    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: sha256('new-refresh') }),
    );
    expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  });

  it('refresh: should still accept legacy bcrypt-hashed tokens and migrate to SHA-256', async () => {
    mocks.refreshTokensRepository.findById.mockResolvedValue(
      activeRow({ tokenHash: '$2b$10$legacybcrypthashlegacybcrypthashlegacybcrypthashlegac' }),
    );
    mocks.passwordHasher.compare.mockResolvedValue(true);
    arrangeSuccessfulRotation();

    const result = await service.refresh('token');

    expect(mocks.passwordHasher.compare).toHaveBeenCalledWith(
      'token',
      expect.stringMatching(/^\$2b\$/),
    );
    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: sha256('new-refresh') }),
    );
    expect(result.refreshToken).toBe('new-refresh');
  });

  it('refresh: should reject legacy bcrypt token on mismatch and revoke all', async () => {
    mocks.refreshTokensRepository.findById.mockResolvedValue(
      activeRow({ tokenHash: '$2b$10$legacybcrypthashlegacybcrypthashlegacybcrypthashlegac' }),
    );
    mocks.passwordHasher.compare.mockResolvedValue(false);

    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mocks.refreshTokensRepository.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('refresh: losing the atomic revoke race is rejected without issuing or revoking all', async () => {
    mocks.refreshTokensRepository.findById.mockResolvedValue(activeRow());
    arrangeSuccessfulRotation();
    mocks.refreshTokensRepository.revokeIfActive.mockResolvedValue(false);

    await expect(service.refresh('token')).rejects.toThrow('Refresh token expired or revoked');
    expect(mocks.refreshTokensRepository.revokeAllForUser).not.toHaveBeenCalled();
    expect(mocks.refreshTokensRepository.issue).not.toHaveBeenCalled();
  });

  it('refresh: concurrent use of the same token succeeds exactly once', async () => {
    mocks.refreshTokensRepository.findById.mockResolvedValue(activeRow());
    arrangeSuccessfulRotation();
    mocks.refreshTokensRepository.revokeIfActive
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const results = await Promise.allSettled([service.refresh('token'), service.refresh('token')]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledTimes(1);
  });

  it('refresh: should reject when user not found', async () => {
    mocks.refreshTokensRepository.findById.mockResolvedValue(activeRow());
    mocks.usersService.getById.mockResolvedValue(null);

    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mocks.refreshTokensRepository.revokeIfActive).not.toHaveBeenCalled();
  });

  it('logout: should revoke all refresh tokens for user', async () => {
    mocks.refreshTokensRepository.revokeAllForUser.mockResolvedValue(undefined);

    await service.logout('u1');

    expect(mocks.refreshTokensRepository.revokeAllForUser).toHaveBeenCalledWith('u1');
  });
});
