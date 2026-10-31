import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from '../../application/auth.service';
import { OAuthService } from '../../application/oauth.service';
import { TokenService } from '../../application/token.service';
import { FacebookAuthGuard } from '../../infrastructure/guards/facebook-auth.guard';
import { GoogleAuthGuard } from '../../infrastructure/guards/google-auth.guard';
import { UsersService } from '../../../users/application/users.service';
import { UserMediaService } from '../../../user-media/application/user-media.service';
import facebookConfig from '../../../../config/facebook.config';
import googleConfig from '../../../../config/google.config';
import authConfig from '../../../../config/auth.config';

/**
 * Creates a mock FastifyRequest for testing.
 */
function createMockRequest(
  overrides: Partial<{ headers: Record<string, string>; ip: string }> = {},
) {
  return {
    headers: {
      'user-agent': 'test-agent',
      ...overrides.headers,
    },
    ip: overrides.ip ?? '127.0.0.1',
    raw: { socket: { remoteAddress: '127.0.0.1' } },
  } as any;
}

/**
 * Creates a mock FastifyReply for testing redirect flows.
 */
function createMockReply() {
  const reply: any = {
    redirect: jest.fn().mockReturnThis(),
    setCookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    code: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return reply;
}

// --- Shared mock factories ---

function createAuthServiceMock() {
  return {
    register: jest.fn(),
    loginValidatedUser: jest.fn(),
    changePassword: jest.fn(),
  };
}

function createTokenServiceMock() {
  return {
    issueTokens: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };
}

function createOAuthServiceMock() {
  return {
    loginWithOAuth: jest.fn(),
    linkOAuthAccount: jest.fn(),
    unlinkOAuthAccount: jest.fn(),
    getLinkedAccounts: jest.fn(),
    getLinkedProviders: jest.fn(),
    generateExchangeCode: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
  };
}

function createGoogleAuthGuardMock() {
  return {
    canActivate: jest.fn().mockResolvedValue(true),
    buildSignedStateForLink: jest.fn().mockReturnValue('signed-google-state'),
    setStateCookie: jest.fn(),
    buildAuthUrl: jest
      .fn()
      .mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=signed-google-state'),
  };
}

function createFacebookAuthGuardMock() {
  return {
    canActivate: jest.fn().mockResolvedValue(true),
    buildSignedStateForLink: jest.fn().mockReturnValue('signed-facebook-state'),
    setStateCookie: jest.fn(),
    buildAuthUrl: jest
      .fn()
      .mockReturnValue('https://www.facebook.com/v24.0/dialog/oauth?state=signed-facebook-state'),
  };
}

function createJwtServiceMock() {
  return {
    sign: jest.fn().mockReturnValue('mock-jwt'),
    signAsync: jest.fn().mockResolvedValue('mock-jwt'),
    verify: jest.fn().mockReturnValue({ sub: 'u1' }),
    verifyAsync: jest.fn().mockResolvedValue({ sub: 'u1' }),
  };
}

const mockGoogleConfig = {
  clientId: '',
  clientSecret: '',
  callbackUrl: '',
  enabled: false,
};

const mockFacebookConfig = {
  appId: '',
  appSecret: '',
  callbackUrl: '',
  enabled: false,
};

const mockAuthConfig = {
  jwtSecret: 'test-secret',
  jwtExpiresIn: '15m',
  refreshSecret: 'test-refresh-secret',
  refreshExpiresIn: '7d',
  frontendUrl: 'http://localhost:3000',
  exchangeCodePepper: 'test-pepper',
  stateSecret: 'test-state-secret',
};

/**
 * Builds a TestingModule with all AuthController dependencies mocked.
 * Returns the compiled module and all mocks for assertions.
 */
async function buildTestModule(overrides?: {
  authService?: ReturnType<typeof createAuthServiceMock>;
  tokenService?: ReturnType<typeof createTokenServiceMock>;
  oauthService?: ReturnType<typeof createOAuthServiceMock>;
  googleGuard?: ReturnType<typeof createGoogleAuthGuardMock>;
  facebookGuard?: ReturnType<typeof createFacebookAuthGuardMock>;
  jwtService?: ReturnType<typeof createJwtServiceMock>;
  usersService?: { getById: jest.Mock };
  userMediaService?: { getStats: jest.Mock };
  googleCfg?: typeof mockGoogleConfig;
  facebookCfg?: typeof mockFacebookConfig;
}) {
  const authService = overrides?.authService ?? createAuthServiceMock();
  const tokenService = overrides?.tokenService ?? createTokenServiceMock();
  const oauthService = overrides?.oauthService ?? createOAuthServiceMock();
  const googleGuard = overrides?.googleGuard ?? createGoogleAuthGuardMock();
  const facebookGuard = overrides?.facebookGuard ?? createFacebookAuthGuardMock();
  const jwtService = overrides?.jwtService ?? createJwtServiceMock();
  const usersService = overrides?.usersService ?? { getById: jest.fn() };
  const userMediaService = overrides?.userMediaService ?? { getStats: jest.fn() };
  const googleCfg = overrides?.googleCfg ?? mockGoogleConfig;
  const facebookCfg = overrides?.facebookCfg ?? mockFacebookConfig;

  const module: TestingModule = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: authService },
      { provide: TokenService, useValue: tokenService },
      { provide: OAuthService, useValue: oauthService },
      { provide: UsersService, useValue: usersService },
      { provide: UserMediaService, useValue: userMediaService },
      { provide: GoogleAuthGuard, useValue: googleGuard },
      { provide: FacebookAuthGuard, useValue: facebookGuard },
      { provide: JwtService, useValue: jwtService },
      { provide: googleConfig.KEY, useValue: googleCfg },
      { provide: facebookConfig.KEY, useValue: facebookCfg },
      { provide: authConfig.KEY, useValue: mockAuthConfig },
    ],
  }).compile();

  const controller = module.get(AuthController);

  return {
    controller,
    authService,
    tokenService,
    oauthService,
    usersService,
    userMediaService,
    googleGuard,
    facebookGuard,
    jwtService,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthController.register', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof createAuthServiceMock>;

  beforeEach(async () => {
    const ctx = await buildTestModule();
    controller = ctx.controller;
    authService = ctx.authService;
    jest.clearAllMocks();
  });

  it('should call authService.register and return tokens', async () => {
    authService.register.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

    const mockReq = createMockRequest();
    const result = await controller.register(
      {
        email: 'user@example.com',
        username: 'ratingo_fan',
        password: 'S3curePassw0rd',
      } as any,
      mockReq,
    );

    expect(authService.register).toHaveBeenCalledWith(
      'user@example.com',
      'ratingo_fan',
      'S3curePassw0rd',
      { userAgent: 'test-agent', ip: '127.0.0.1' },
    );
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('should extract Cloudflare IP when cf-connecting-ip header is present', async () => {
    authService.register.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

    const mockReq = createMockRequest({
      headers: { 'cf-connecting-ip': '203.0.113.50' },
      ip: '10.0.0.1', // proxy IP
    });

    await controller.register(
      {
        email: 'user@example.com',
        username: 'ratingo_fan',
        password: 'S3curePassw0rd',
      } as any,
      mockReq,
    );

    expect(authService.register).toHaveBeenCalledWith(
      'user@example.com',
      'ratingo_fan',
      'S3curePassw0rd',
      { userAgent: 'test-agent', ip: '203.0.113.50' },
    );
  });

  it('should extract IP from x-forwarded-for when cf-connecting-ip is absent', async () => {
    authService.register.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

    const mockReq = createMockRequest({
      headers: { 'x-forwarded-for': '198.51.100.25, 10.0.0.1' },
      ip: '10.0.0.1',
    });

    await controller.register(
      {
        email: 'user@example.com',
        username: 'ratingo_fan',
        password: 'S3curePassw0rd',
      } as any,
      mockReq,
    );

    expect(authService.register).toHaveBeenCalledWith(
      'user@example.com',
      'ratingo_fan',
      'S3curePassw0rd',
      { userAgent: 'test-agent', ip: '198.51.100.25' },
    );
  });
});

describe('AuthController.login', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof createAuthServiceMock>;

  beforeEach(async () => {
    const ctx = await buildTestModule();
    controller = ctx.controller;
    authService = ctx.authService;
    jest.clearAllMocks();
  });

  it('should call authService.loginValidatedUser with user from @CurrentUser() and return tokens', async () => {
    const validatedUser = {
      id: 'u1',
      email: 'user@example.com',
      role: 'user',
    } as any;

    authService.loginValidatedUser.mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
    });

    const mockReq = createMockRequest();
    const result = await controller.login(validatedUser, mockReq);

    expect(authService.loginValidatedUser).toHaveBeenCalledWith(validatedUser, {
      userAgent: 'test-agent',
      ip: '127.0.0.1',
    });
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });
});

describe('AuthController.changePassword', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof createAuthServiceMock>;

  beforeEach(async () => {
    const ctx = await buildTestModule();
    controller = ctx.controller;
    authService = ctx.authService;
    jest.clearAllMocks();
  });

  it('should delegate changePassword to authService', async () => {
    authService.changePassword.mockResolvedValue(undefined);

    await controller.changePassword({ id: 'u1' }, {
      currentPassword: 'OldPass123',
      newPassword: 'NewPass456',
    } as any);

    expect(authService.changePassword).toHaveBeenCalledWith('u1', 'OldPass123', 'NewPass456');
  });

  it('should return void (no content)', async () => {
    authService.changePassword.mockResolvedValue(undefined);

    const result = await controller.changePassword({ id: 'u1' }, {
      currentPassword: 'OldPass123',
      newPassword: 'NewPass456',
    } as any);

    expect(result).toBeUndefined();
  });
});

describe('AuthController.me', () => {
  let controller: AuthController;
  let oauthService: ReturnType<typeof createOAuthServiceMock>;
  let usersService: { getById: jest.Mock };
  let userMediaService: { getStats: jest.Mock };

  beforeEach(async () => {
    const ctx = await buildTestModule();
    controller = ctx.controller;
    oauthService = ctx.oauthService;
    usersService = ctx.usersService;
    userMediaService = ctx.userMediaService;
    jest.clearAllMocks();
  });

  it('should return mapped MeDto for authenticated user', async () => {
    const dbUser = {
      id: 'u1',
      email: 'user@example.com',
      username: 'ratingo_fan',
      passwordHash: 'hashed',
      avatarUrl: null,
      role: 'user',
      bio: null,
      location: null,
      website: null,
      preferredLanguage: 'uk',
      preferredRegion: 'UA',
      isProfilePublic: true,
      showWatchHistory: true,
      showRatings: true,
      allowFollowers: true,
      autoSubscribeOnWatch: true,
    };
    const stats = { moviesRated: 5, showsRated: 2, watchlistCount: 10 };

    usersService.getById.mockResolvedValue(dbUser);
    userMediaService.getStats.mockResolvedValue(stats);
    oauthService.getLinkedProviders.mockResolvedValue([]);

    const result = await controller.me({ id: 'u1', email: 'user@example.com', role: 'user' });

    expect(usersService.getById).toHaveBeenCalledWith('u1');
    expect(userMediaService.getStats).toHaveBeenCalledWith('u1');
    expect(oauthService.getLinkedProviders).toHaveBeenCalledWith('u1');
    expect(result).toEqual({
      id: 'u1',
      email: 'user@example.com',
      username: 'ratingo_fan',
      avatarUrl: null,
      role: 'user',
      hasPassword: true,
      linkedProviders: [],
      profile: {
        bio: null,
        location: null,
        website: null,
        preferredLanguage: 'uk',
        preferredRegion: 'UA',
        privacy: {
          isProfilePublic: true,
          showWatchHistory: true,
          showRatings: true,
          allowFollowers: true,
          autoSubscribeOnWatch: true,
        },
      },
      stats,
    });
  });

  it('should throw NotFoundException when user not found', async () => {
    usersService.getById.mockResolvedValue(null);

    await expect(
      controller.me({ id: 'u-missing', email: 'gone@example.com', role: 'user' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(userMediaService.getStats).not.toHaveBeenCalled();
  });
});

describe('AuthController.refresh', () => {
  let controller: AuthController;
  let tokenService: ReturnType<typeof createTokenServiceMock>;

  beforeEach(async () => {
    const ctx = await buildTestModule();
    controller = ctx.controller;
    tokenService = ctx.tokenService;
    jest.clearAllMocks();
  });

  it('should delegate to tokenService.refresh with refreshToken and clientMeta', async () => {
    tokenService.refresh.mockResolvedValue({ accessToken: 'new-a', refreshToken: 'new-r' });

    const mockReq = createMockRequest();
    const result = await controller.refresh({ refreshToken: 'old-rt' } as any, mockReq);

    expect(tokenService.refresh).toHaveBeenCalledWith('old-rt', {
      userAgent: 'test-agent',
      ip: '127.0.0.1',
    });
    expect(result).toEqual({ accessToken: 'new-a', refreshToken: 'new-r' });
  });
});

describe('AuthController.logout', () => {
  let controller: AuthController;
  let tokenService: ReturnType<typeof createTokenServiceMock>;

  beforeEach(async () => {
    const ctx = await buildTestModule();
    controller = ctx.controller;
    tokenService = ctx.tokenService;
    jest.clearAllMocks();
  });

  it('should delegate to tokenService.logout with user id', async () => {
    tokenService.logout.mockResolvedValue(undefined);

    const result = await controller.logout({ id: 'u1' });

    expect(tokenService.logout).toHaveBeenCalledWith('u1');
    expect(result).toBeUndefined();
  });
});

describe('AuthController.exchangeCode', () => {
  let controller: AuthController;
  let oauthService: ReturnType<typeof createOAuthServiceMock>;

  beforeEach(async () => {
    const ctx = await buildTestModule();
    controller = ctx.controller;
    oauthService = ctx.oauthService;
    jest.clearAllMocks();
  });

  it('should delegate to oauthService.exchangeCodeForTokens with code and clientMeta', async () => {
    oauthService.exchangeCodeForTokens.mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
    });

    const mockReq = createMockRequest();
    const result = await controller.exchangeCode({ code: 'one-time-code' } as any, mockReq);

    expect(oauthService.exchangeCodeForTokens).toHaveBeenCalledWith('one-time-code', {
      userAgent: 'test-agent',
      ip: '127.0.0.1',
    });
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });
});

describe('AuthController.linkGoogle', () => {
  let controller: AuthController;
  let googleGuard: ReturnType<typeof createGoogleAuthGuardMock>;
  let jwtService: ReturnType<typeof createJwtServiceMock>;

  beforeEach(async () => {
    const ctx = await buildTestModule();
    controller = ctx.controller;
    googleGuard = ctx.googleGuard;
    jwtService = ctx.jwtService;
    jest.clearAllMocks();
  });

  it('should verify token, build signed state, set cookie, and redirect', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1' });
    const mockRes = createMockReply();

    await controller.linkGoogle('valid-token', '/settings', mockRes);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token');
    expect(googleGuard.buildSignedStateForLink).toHaveBeenCalledWith('u1', '/settings');
    expect(googleGuard.setStateCookie).toHaveBeenCalledWith(mockRes, 'signed-google-state');
    expect(googleGuard.buildAuthUrl).toHaveBeenCalledWith('signed-google-state');
    expect(mockRes.redirect).toHaveBeenCalledWith(
      302,
      'https://accounts.google.com/o/oauth2/v2/auth?state=signed-google-state',
    );
  });

  it('should throw UnauthorizedException when token is invalid', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const mockRes = createMockReply();

    await expect(
      controller.linkGoogle('expired-token', '/settings', mockRes),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(googleGuard.buildSignedStateForLink).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when token is empty', async () => {
    const mockRes = createMockReply();

    await expect(controller.linkGoogle('', undefined, mockRes)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('AuthController.linkFacebook', () => {
  let controller: AuthController;
  let facebookGuard: ReturnType<typeof createFacebookAuthGuardMock>;
  let jwtService: ReturnType<typeof createJwtServiceMock>;

  beforeEach(async () => {
    const ctx = await buildTestModule();
    controller = ctx.controller;
    facebookGuard = ctx.facebookGuard;
    jwtService = ctx.jwtService;
    jest.clearAllMocks();
  });

  it('should verify token, build signed state, set cookie, and redirect', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u2' });
    const mockRes = createMockReply();

    await controller.linkFacebook('valid-token', '/settings', mockRes);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token');
    expect(facebookGuard.buildSignedStateForLink).toHaveBeenCalledWith('u2', '/settings');
    expect(facebookGuard.setStateCookie).toHaveBeenCalledWith(mockRes, 'signed-facebook-state');
    expect(facebookGuard.buildAuthUrl).toHaveBeenCalledWith('signed-facebook-state');
    expect(mockRes.redirect).toHaveBeenCalledWith(
      302,
      'https://www.facebook.com/v24.0/dialog/oauth?state=signed-facebook-state',
    );
  });

  it('should throw UnauthorizedException when token is invalid', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const mockRes = createMockReply();

    await expect(
      controller.linkFacebook('expired-token', '/settings', mockRes),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(facebookGuard.buildSignedStateForLink).not.toHaveBeenCalled();
  });
});

describe('AuthController.getLinkedAccounts', () => {
  let controller: AuthController;
  let oauthService: ReturnType<typeof createOAuthServiceMock>;

  beforeEach(async () => {
    const ctx = await buildTestModule();
    controller = ctx.controller;
    oauthService = ctx.oauthService;
    jest.clearAllMocks();
  });

  it('should return mapped linked accounts', async () => {
    const linkedDate = new Date('2025-06-15T10:30:00.000Z');
    oauthService.getLinkedAccounts.mockResolvedValue([
      {
        provider: 'google',
        email: 'user@gmail.com',
        displayName: 'John Doe',
        createdAt: linkedDate,
      },
    ]);

    const result = await controller.getLinkedAccounts({ id: 'u1' });

    expect(oauthService.getLinkedAccounts).toHaveBeenCalledWith('u1');
    expect(result).toEqual([
      {
        provider: 'google',
        email: 'user@gmail.com',
        displayName: 'John Doe',
        linkedAt: '2025-06-15T10:30:00.000Z',
      },
    ]);
  });

  it('should return empty array when no accounts linked', async () => {
    oauthService.getLinkedAccounts.mockResolvedValue([]);

    const result = await controller.getLinkedAccounts({ id: 'u1' });

    expect(result).toEqual([]);
  });
});

describe('AuthController.unlinkProvider', () => {
  let controller: AuthController;
  let oauthService: ReturnType<typeof createOAuthServiceMock>;

  beforeEach(async () => {
    const ctx = await buildTestModule();
    controller = ctx.controller;
    oauthService = ctx.oauthService;
    jest.clearAllMocks();
  });

  it('should delegate to oauthService.unlinkOAuthAccount', async () => {
    oauthService.unlinkOAuthAccount.mockResolvedValue(undefined);

    const result = await controller.unlinkProvider({ id: 'u1' }, { provider: 'google' } as any);

    expect(oauthService.unlinkOAuthAccount).toHaveBeenCalledWith('u1', 'google');
    expect(result).toBeUndefined();
  });
});

describe('AuthController.handleOAuthCallback - link mode', () => {
  let controller: AuthController;
  let oauthService: ReturnType<typeof createOAuthServiceMock>;

  const frontendUrl = mockAuthConfig.frontendUrl;

  const defaultOAuthUser = {
    provider: 'google' as const,
    providerAccountId: 'gid-123',
    email: 'user@gmail.com',
    name: 'Test User',
    picture: null,
  };

  beforeEach(async () => {
    const ctx = await buildTestModule();
    controller = ctx.controller;
    oauthService = ctx.oauthService;
    jest.clearAllMocks();
  });

  /**
   * Helper: invokes the private handleOAuthCallback through the public
   * googleCallback method, which is the real entry point.
   * Uses `as any` to allow passing different provider values since the
   * private handleOAuthCallback is provider-agnostic.
   */
  async function callOAuthCallback(
    oauthUser: Record<string, unknown>,
    statePayload: Record<string, unknown> | undefined,
    res: ReturnType<typeof createMockReply>,
  ) {
    const req = {
      ...createMockRequest(),
      oauthStatePayload: statePayload,
    } as any;

    // googleCallback passes @CurrentUser() oauthUser, @Req() req, @Res() res
    // We call the controller method directly; guards are skipped in unit tests.
    await controller.googleCallback(oauthUser as any, req, res);
  }

  it('should redirect to settings with ?linked= on successful link', async () => {
    oauthService.linkOAuthAccount.mockResolvedValue(undefined);
    const mockRes = createMockReply();

    await callOAuthCallback(
      defaultOAuthUser,
      { mode: 'link', linkUserId: 'user-123', provider: 'google', returnTo: '/settings' },
      mockRes,
    );

    expect(oauthService.linkOAuthAccount).toHaveBeenCalledWith('user-123', defaultOAuthUser);
    expect(mockRes.redirect).toHaveBeenCalledWith(302, `${frontendUrl}/settings?linked=google`);
  });

  it('should redirect with ?linkError=ALREADY_LINKED on conflict', async () => {
    oauthService.linkOAuthAccount.mockRejectedValue(
      new ConflictException('Account already linked'),
    );
    const mockRes = createMockReply();

    await callOAuthCallback(
      defaultOAuthUser,
      { mode: 'link', linkUserId: 'user-123', provider: 'google', returnTo: '/settings' },
      mockRes,
    );

    expect(oauthService.linkOAuthAccount).toHaveBeenCalledWith('user-123', defaultOAuthUser);
    expect(mockRes.redirect).toHaveBeenCalledWith(
      302,
      `${frontendUrl}/settings?linkError=ALREADY_LINKED&provider=google`,
    );
  });

  it('should redirect with ?linkError=LINK_FAILED on unexpected error', async () => {
    oauthService.linkOAuthAccount.mockRejectedValue(new Error('Database connection lost'));
    const mockRes = createMockReply();

    await callOAuthCallback(
      defaultOAuthUser,
      { mode: 'link', linkUserId: 'user-123', provider: 'google', returnTo: '/settings' },
      mockRes,
    );

    expect(mockRes.redirect).toHaveBeenCalledWith(
      302,
      `${frontendUrl}/settings?linkError=LINK_FAILED&provider=google`,
    );
  });

  it('should use /settings as default returnTo for link mode', async () => {
    oauthService.linkOAuthAccount.mockResolvedValue(undefined);
    const mockRes = createMockReply();

    const facebookOAuthUser = { ...defaultOAuthUser, provider: 'facebook' as const };

    await callOAuthCallback(
      facebookOAuthUser,
      { mode: 'link', linkUserId: 'user-123', provider: 'facebook' },
      mockRes,
    );

    expect(oauthService.linkOAuthAccount).toHaveBeenCalledWith('user-123', facebookOAuthUser);
    expect(mockRes.redirect).toHaveBeenCalledWith(302, `${frontendUrl}/settings?linked=facebook`);
  });

  it('should use oauthUser.provider when statePayload.provider is missing', async () => {
    oauthService.linkOAuthAccount.mockResolvedValue(undefined);
    const mockRes = createMockReply();

    const facebookOAuthUser = { ...defaultOAuthUser, provider: 'facebook' as const };

    await callOAuthCallback(facebookOAuthUser, { mode: 'link', linkUserId: 'user-123' }, mockRes);

    expect(mockRes.redirect).toHaveBeenCalledWith(302, `${frontendUrl}/settings?linked=facebook`);
  });
});

describe('AuthController.getConfig', () => {
  it('should return config with both providers disabled', async () => {
    const ctx = await buildTestModule();
    const controller = ctx.controller;

    const result = controller.getConfig();

    expect(result).toEqual({
      google: { enabled: false },
      facebook: { enabled: false },
    });
  });

  it('should return config with google enabled', async () => {
    const ctx = await buildTestModule({
      googleCfg: { ...mockGoogleConfig, enabled: true },
    });
    const controller = ctx.controller;

    const result = controller.getConfig();

    expect(result).toEqual({
      google: { enabled: true },
      facebook: { enabled: false },
    });
  });

  it('should return config with both providers enabled', async () => {
    const ctx = await buildTestModule({
      googleCfg: { ...mockGoogleConfig, enabled: true },
      facebookCfg: { ...mockFacebookConfig, enabled: true },
    });
    const controller = ctx.controller;

    const result = controller.getConfig();

    expect(result).toEqual({
      google: { enabled: true },
      facebook: { enabled: true },
    });
  });
});
