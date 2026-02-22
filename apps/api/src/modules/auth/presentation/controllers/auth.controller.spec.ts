import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../../application/auth.service';
import { UsersService } from '../../../users/application/users.service';
import { UserMediaService } from '../../../user-media/application/user-media.service';
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

describe('AuthController.register', () => {
  let controller: AuthController;

  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    loginValidatedUser: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  const usersService = {
    getById: jest.fn(),
  };

  const userMediaService = {
    getStats: jest.fn(),
  };

  const mockGoogleConfig = {
    clientId: '',
    clientSecret: '',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: UserMediaService, useValue: userMediaService },
        { provide: googleConfig.KEY, useValue: mockGoogleConfig },
        { provide: authConfig.KEY, useValue: mockAuthConfig },
      ],
    }).compile();

    controller = module.get(AuthController);
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

  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    loginValidatedUser: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  const usersService = {
    getById: jest.fn(),
  };

  const userMediaService = {
    getStats: jest.fn(),
  };

  const mockGoogleConfig = {
    clientId: '',
    clientSecret: '',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: UserMediaService, useValue: userMediaService },
        { provide: googleConfig.KEY, useValue: mockGoogleConfig },
        { provide: authConfig.KEY, useValue: mockAuthConfig },
      ],
    }).compile();

    controller = module.get(AuthController);
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

  it('should not call authService.login (deprecated path)', async () => {
    const validatedUser = { id: 'u1', email: 'user@example.com', role: 'user' } as any;
    authService.loginValidatedUser.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

    const mockReq = createMockRequest();
    await controller.login(validatedUser, mockReq);

    expect(authService.login).not.toHaveBeenCalled();
  });
});

describe('AuthController.changePassword', () => {
  let controller: AuthController;

  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    loginValidatedUser: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    changePassword: jest.fn(),
  };

  const usersService = {
    getById: jest.fn(),
  };

  const userMediaService = {
    getStats: jest.fn(),
  };

  const mockGoogleConfig = {
    clientId: '',
    clientSecret: '',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: UserMediaService, useValue: userMediaService },
        { provide: googleConfig.KEY, useValue: mockGoogleConfig },
        { provide: authConfig.KEY, useValue: mockAuthConfig },
      ],
    }).compile();

    controller = module.get(AuthController);
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

  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    loginValidatedUser: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
  };

  const usersService = {
    getById: jest.fn(),
  };

  const userMediaService = {
    getStats: jest.fn(),
  };

  const mockGoogleConfig = {
    clientId: '',
    clientSecret: '',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: UserMediaService, useValue: userMediaService },
        { provide: googleConfig.KEY, useValue: mockGoogleConfig },
        { provide: authConfig.KEY, useValue: mockAuthConfig },
      ],
    }).compile();

    controller = module.get(AuthController);
    jest.clearAllMocks();
  });

  it('should return mapped MeDto for authenticated user', async () => {
    const dbUser = {
      id: 'u1',
      email: 'user@example.com',
      username: 'ratingo_fan',
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

    const result = await controller.me({ id: 'u1', email: 'user@example.com', role: 'user' });

    expect(usersService.getById).toHaveBeenCalledWith('u1');
    expect(userMediaService.getStats).toHaveBeenCalledWith('u1');
    expect(result).toEqual({
      id: 'u1',
      email: 'user@example.com',
      username: 'ratingo_fan',
      avatarUrl: null,
      role: 'user',
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

  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    loginValidatedUser: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
  };

  const usersService = {
    getById: jest.fn(),
  };

  const userMediaService = {
    getStats: jest.fn(),
  };

  const mockGoogleConfig = {
    clientId: '',
    clientSecret: '',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: UserMediaService, useValue: userMediaService },
        { provide: googleConfig.KEY, useValue: mockGoogleConfig },
        { provide: authConfig.KEY, useValue: mockAuthConfig },
      ],
    }).compile();

    controller = module.get(AuthController);
    jest.clearAllMocks();
  });

  it('should delegate to authService.refresh with refreshToken and clientMeta', async () => {
    authService.refresh.mockResolvedValue({ accessToken: 'new-a', refreshToken: 'new-r' });

    const mockReq = createMockRequest();
    const result = await controller.refresh({ refreshToken: 'old-rt' } as any, mockReq);

    expect(authService.refresh).toHaveBeenCalledWith('old-rt', {
      userAgent: 'test-agent',
      ip: '127.0.0.1',
    });
    expect(result).toEqual({ accessToken: 'new-a', refreshToken: 'new-r' });
  });
});

describe('AuthController.logout', () => {
  let controller: AuthController;

  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    loginValidatedUser: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
  };

  const usersService = {
    getById: jest.fn(),
  };

  const userMediaService = {
    getStats: jest.fn(),
  };

  const mockGoogleConfig = {
    clientId: '',
    clientSecret: '',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: UserMediaService, useValue: userMediaService },
        { provide: googleConfig.KEY, useValue: mockGoogleConfig },
        { provide: authConfig.KEY, useValue: mockAuthConfig },
      ],
    }).compile();

    controller = module.get(AuthController);
    jest.clearAllMocks();
  });

  it('should delegate to authService.logout with user id', async () => {
    authService.logout.mockResolvedValue(undefined);

    const result = await controller.logout({ id: 'u1' });

    expect(authService.logout).toHaveBeenCalledWith('u1');
    expect(result).toBeUndefined();
  });
});

describe('AuthController.exchangeCode', () => {
  let controller: AuthController;

  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    loginValidatedUser: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
  };

  const usersService = {
    getById: jest.fn(),
  };

  const userMediaService = {
    getStats: jest.fn(),
  };

  const mockGoogleConfig = {
    clientId: '',
    clientSecret: '',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: UserMediaService, useValue: userMediaService },
        { provide: googleConfig.KEY, useValue: mockGoogleConfig },
        { provide: authConfig.KEY, useValue: mockAuthConfig },
      ],
    }).compile();

    controller = module.get(AuthController);
    jest.clearAllMocks();
  });

  it('should delegate to authService.exchangeCodeForTokens with code and clientMeta', async () => {
    authService.exchangeCodeForTokens.mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
    });

    const mockReq = createMockRequest();
    const result = await controller.exchangeCode({ code: 'one-time-code' } as any, mockReq);

    expect(authService.exchangeCodeForTokens).toHaveBeenCalledWith('one-time-code', {
      userAgent: 'test-agent',
      ip: '127.0.0.1',
    });
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });
});
