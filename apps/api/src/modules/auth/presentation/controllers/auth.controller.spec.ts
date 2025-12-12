import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../../application/auth.service';
import { UsersService } from '../../../users/application/users.service';
import { UserMediaService } from '../../../user-media/application/user-media.service';

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

    const result = await controller.register({
      email: 'user@example.com',
      username: 'ratingo_fan',
      password: 'S3curePassw0rd',
    } as any);

    expect(authService.register).toHaveBeenCalledWith(
      'user@example.com',
      'ratingo_fan',
      'S3curePassw0rd',
    );
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });
});
