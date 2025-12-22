import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../../application/auth.service';
import { UsersService } from '../../../users/application/users.service';
import { UserMediaService } from '../../../user-media/application/user-media.service';

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
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  const usersService = {
    getById: jest.fn(),
  };

  const userMediaService = {
    getStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        { provide: UserMediaService, useValue: userMediaService },
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
