import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';
import { type AuthMocks, createAuthMocks, createTokenService } from '../../../../test/auth/_mocks';

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
    mocks.passwordHasher.hash.mockResolvedValue('refresh-hash');
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

    // Refresh token is hashed before persistence
    expect(mocks.passwordHasher.hash).toHaveBeenCalledWith('refresh-token');
    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledTimes(1);
    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        tokenHash: 'refresh-hash',
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
    mocks.passwordHasher.hash.mockResolvedValue('rh');
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

  it('refresh: should reject missing/expired/revoked token', async () => {
    (mocks.jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'u1',
      jti: 'j1',
      type: 'refresh',
    });
    mocks.refreshTokensRepository.findById.mockResolvedValueOnce(null);
    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);

    mocks.refreshTokensRepository.findById.mockResolvedValueOnce({
      id: 'j1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      tokenHash: 'h',
      userId: 'u1',
    });
    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);

    mocks.refreshTokensRepository.findById.mockResolvedValueOnce({
      id: 'j1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      tokenHash: 'h',
      userId: 'u1',
    });
    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh: should detect reuse (hash mismatch) and revoke all for user', async () => {
    (mocks.jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'u1',
      jti: 'j1',
      type: 'refresh',
    });
    mocks.refreshTokensRepository.findById.mockResolvedValue({
      id: 'j1',
      userId: 'u1',
      tokenHash: 'stored-hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000),
    });
    mocks.passwordHasher.compare.mockResolvedValue(false);

    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mocks.refreshTokensRepository.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('refresh: should rotate token on success', async () => {
    (mocks.jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'u1',
      jti: 'j1',
      type: 'refresh',
    });
    mocks.refreshTokensRepository.findById.mockResolvedValue({
      id: 'j1',
      userId: 'u1',
      tokenHash: 'stored-hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000),
    });
    mocks.passwordHasher.compare.mockResolvedValue(true);
    mocks.usersService.getById.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      role: 'user',
    });
    (mocks.jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('new-access')
      .mockResolvedValueOnce('new-refresh');
    mocks.passwordHasher.hash.mockResolvedValue('new-refresh-hash');
    mocks.refreshTokensRepository.issue.mockResolvedValue({ id: 'new-jti' });

    const result = await service.refresh('token');

    expect(mocks.refreshTokensRepository.revoke).toHaveBeenCalledWith('j1');
    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  });

  it('refresh: should reject when user not found', async () => {
    (mocks.jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'u-missing',
      jti: 'j1',
      type: 'refresh',
    });
    mocks.refreshTokensRepository.findById.mockResolvedValue({
      id: 'j1',
      userId: 'u-missing',
      tokenHash: 'stored-hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000),
    });
    mocks.passwordHasher.compare.mockResolvedValue(true);
    mocks.usersService.getById.mockResolvedValue(null);

    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logout: should revoke all refresh tokens for user', async () => {
    mocks.refreshTokensRepository.revokeAllForUser.mockResolvedValue(undefined);

    await service.logout('u1');

    expect(mocks.refreshTokensRepository.revokeAllForUser).toHaveBeenCalledWith('u1');
  });
});
