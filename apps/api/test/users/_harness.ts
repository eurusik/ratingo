import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { UsersModule } from '../../src/modules/users/users.module';
import { JwtService } from '@nestjs/jwt';
import { USERS_REPOSITORY } from '../../src/modules/users/domain/repositories/users.repository.interface';
import { REFRESH_TOKENS_REPOSITORY } from '../../src/modules/auth/domain/repositories/refresh-tokens.repository.interface';
import { USER_MEDIA_STATE_REPOSITORY } from '../../src/modules/user-media/domain/repositories/user-media-state.repository.interface';
import { OBJECT_STORAGE_SERVICE } from '../../src/modules/users/domain/services/object-storage.service.interface';
import {
  InMemoryRefreshTokensRepository,
  InMemoryUserMediaRepository,
  InMemoryUsersRepository,
} from './_fakes';
import { createE2eApp, createE2eTestingModule } from '../support/e2e-testing-module';
import { OAUTH_ACCOUNTS_REPOSITORY } from '../../src/modules/auth/domain/repositories/oauth-accounts.repository.interface';
import { InMemoryOAuthAccountsRepository } from '../support/in-memory-oauth-accounts.repository';

export interface UsersE2eContext {
  app: INestApplication;
  authBase: string;
  usersBase: string;
  usersRepo: InMemoryUsersRepository;
  userMediaRepo: InMemoryUserMediaRepository;
  makeAccessToken: (payload: { sub: string; email: string; role: string }) => Promise<string>;
  registerAndLogin: () => Promise<{
    accessToken: string;
    email: string;
    username: string;
    password: string;
  }>;
  get: (path: string, token?: string) => any;
  post: (path: string, token?: string) => any;
  patch: (path: string, token?: string) => any;
  close: () => Promise<void>;
}

export async function createUsersApp(): Promise<UsersE2eContext> {
  const moduleFixture: TestingModule = await createE2eTestingModule({
    imports: [AuthModule, UsersModule],
  })
    .overrideProvider(USERS_REPOSITORY)
    .useClass(InMemoryUsersRepository)
    .overrideProvider(REFRESH_TOKENS_REPOSITORY)
    .useClass(InMemoryRefreshTokensRepository)
    .overrideProvider(USER_MEDIA_STATE_REPOSITORY)
    .useClass(InMemoryUserMediaRepository)
    .overrideProvider(OAUTH_ACCOUNTS_REPOSITORY)
    .useClass(InMemoryOAuthAccountsRepository)
    .overrideProvider(OBJECT_STORAGE_SERVICE)
    .useValue({
      getPresignedPutUrl: async ({ key }: { key: string }) => ({
        uploadUrl: `https://uploads.example.com/signed-put?key=${encodeURIComponent(key)}`,
        publicUrl: `https://cdn.example.com/${key}`,
        key,
      }),
    })
    .compile();

  const app = await createE2eApp(moduleFixture);
  const usersRepo = app.get(USERS_REPOSITORY) as unknown as InMemoryUsersRepository;
  const userMediaRepo = app.get(
    USER_MEDIA_STATE_REPOSITORY,
  ) as unknown as InMemoryUserMediaRepository;
  const configService = app.get(ConfigService);
  const jwtService = app.get(JwtService);

  const makeAccessToken = async (payload: { sub: string; email: string; role: string }) => {
    const secret = configService.get<string>('auth.accessTokenSecret');
    return jwtService.signAsync(payload, {
      secret,
      expiresIn: '15m',
    });
  };

  const authBase = '/api/auth';
  const usersBase = '/api/users';

  const registerAndLogin = async () => {
    const email = `user${Date.now()}@example.com`;
    const username = `user${Date.now()}`;
    const password = 'S3curePassw0rd';

    await request(app.getHttpServer())
      .post(`${authBase}/register`)
      .send({ email, username, password })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post(`${authBase}/login`)
      .send({ email, password })
      .expect(200);

    return {
      accessToken: loginRes.body.data.accessToken as string,
      email,
      username,
      password,
    };
  };

  const get = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).get(path);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  const post = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).post(path);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  const patch = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).patch(path);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  return {
    app,
    authBase,
    usersBase,
    usersRepo,
    userMediaRepo,
    makeAccessToken,
    registerAndLogin,
    get,
    post,
    patch,
    close: () => app.close(),
  };
}
