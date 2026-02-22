import { type JwtService } from '@nestjs/jwt';
import { AuthService } from '../../src/modules/auth/application/auth.service';

/**
 * Shape of all mock dependencies required to instantiate AuthService in tests.
 */
export interface AuthMocks {
  usersService: {
    getByEmail: jest.Mock;
    getByUsername: jest.Mock;
    createUser: jest.Mock;
    getById: jest.Mock;
    updatePassword: jest.Mock;
    getByGoogleId: jest.Mock;
    linkGoogleId: jest.Mock;
    updateProfile: jest.Mock;
  };
  jwtService: Pick<JwtService, 'signAsync' | 'verifyAsync'>;
  passwordHasher: {
    hash: jest.Mock;
    compare: jest.Mock;
  };
  refreshTokensRepository: {
    issue: jest.Mock;
    findById: jest.Mock;
    findValidByUser: jest.Mock;
    revoke: jest.Mock;
    revokeAllForUser: jest.Mock;
  };
  exchangeCodesRepository: {
    create: jest.Mock;
    consumeCode: jest.Mock;
    cleanupExpired: jest.Mock;
  };
  config: {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenTtl: string;
    refreshTokenTtl: string;
    exchangeCodePepper: string;
    stateSecret: string;
    frontendUrl: string;
  };
}

/**
 * Creates fresh jest mock objects for all AuthService dependencies.
 * Each call returns independent mocks so tests stay isolated.
 */
export function createAuthMocks(): AuthMocks {
  return {
    usersService: {
      getByEmail: jest.fn(),
      getByUsername: jest.fn(),
      createUser: jest.fn(),
      getById: jest.fn(),
      updatePassword: jest.fn(),
      getByGoogleId: jest.fn(),
      linkGoogleId: jest.fn(),
      updateProfile: jest.fn(),
    },
    jwtService: {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    } as any,
    passwordHasher: {
      hash: jest.fn(),
      compare: jest.fn(),
    },
    refreshTokensRepository: {
      issue: jest.fn(),
      findById: jest.fn(),
      findValidByUser: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
    },
    exchangeCodesRepository: {
      create: jest.fn(),
      consumeCode: jest.fn(),
      cleanupExpired: jest.fn(),
    },
    config: {
      accessTokenSecret: 'access-secret',
      refreshTokenSecret: 'refresh-secret',
      accessTokenTtl: '15m',
      refreshTokenTtl: '7d',
      exchangeCodePepper: 'test-pepper',
      stateSecret: 'test-state-secret',
      frontendUrl: 'http://localhost:3000',
    },
  };
}

/**
 * Instantiates AuthService with the provided mocks.
 * Mirrors the real constructor parameter order.
 */
export function createAuthService(mocks: AuthMocks): AuthService {
  return new AuthService(
    mocks.usersService as any,
    mocks.config as any,
    mocks.jwtService as any,
    mocks.passwordHasher as any,
    mocks.refreshTokensRepository as any,
    mocks.exchangeCodesRepository as any,
  );
}
