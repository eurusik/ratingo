import { type JwtService } from '@nestjs/jwt';

import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { TokenService } from './token.service';

/**
 * Shape of all mock dependencies required to instantiate auth services in tests.
 */
export interface AuthMocks {
  usersService: {
    getByEmail: jest.Mock;
    getByUsername: jest.Mock;
    createUser: jest.Mock;
    getById: jest.Mock;
    updatePassword: jest.Mock;
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
    revokeIfActive: jest.Mock;
    revokeAllForUser: jest.Mock;
  };
  exchangeCodesRepository: {
    create: jest.Mock;
    consumeCode: jest.Mock;
    cleanupExpired: jest.Mock;
  };
  oauthAccountsRepository: {
    findByProviderAccount: jest.Mock;
    findByUserId: jest.Mock;
    findByUserAndProvider: jest.Mock;
    create: jest.Mock;
    deleteByUserAndProvider: jest.Mock;
    countByUserId: jest.Mock;
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
      updateProfile: jest.fn(),
    },
    jwtService: {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    } as unknown as AuthMocks['jwtService'],
    passwordHasher: {
      hash: jest.fn(),
      compare: jest.fn(),
    },
    refreshTokensRepository: {
      issue: jest.fn(),
      findById: jest.fn(),
      findValidByUser: jest.fn(),
      revoke: jest.fn(),
      revokeIfActive: jest.fn(),
      revokeAllForUser: jest.fn(),
    },
    exchangeCodesRepository: {
      create: jest.fn(),
      consumeCode: jest.fn(),
      cleanupExpired: jest.fn(),
    },
    oauthAccountsRepository: {
      findByProviderAccount: jest.fn(),
      findByUserId: jest.fn(),
      findByUserAndProvider: jest.fn(),
      create: jest.fn(),
      deleteByUserAndProvider: jest.fn(),
      countByUserId: jest.fn(),
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
 * Instantiates a real TokenService with the provided mocks.
 * Mirrors the real constructor parameter order.
 */
export function createTokenService(mocks: AuthMocks): TokenService {
  const deps = [
    mocks.usersService,
    mocks.config,
    mocks.jwtService,
    mocks.passwordHasher,
    mocks.refreshTokensRepository,
  ] as unknown as ConstructorParameters<typeof TokenService>;
  return new TokenService(...deps);
}

/**
 * Instantiates AuthService with the provided mocks.
 * Uses a real TokenService by default so token-issuance assertions
 * against jwtService/refreshTokensRepository mocks keep working.
 */
export function createAuthService(
  mocks: AuthMocks,
  tokenService: TokenService = createTokenService(mocks),
): AuthService {
  const deps = [
    mocks.usersService,
    mocks.passwordHasher,
    tokenService,
  ] as unknown as ConstructorParameters<typeof AuthService>;
  return new AuthService(...deps);
}

/**
 * Instantiates OAuthService with the provided mocks.
 * Uses a real TokenService by default (see {@link createAuthService}).
 */
export function createOAuthService(
  mocks: AuthMocks,
  tokenService: TokenService = createTokenService(mocks),
): OAuthService {
  const deps = [
    mocks.usersService,
    mocks.config,
    tokenService,
    mocks.exchangeCodesRepository,
    mocks.oauthAccountsRepository,
  ] as unknown as ConstructorParameters<typeof OAuthService>;
  return new OAuthService(...deps);
}
