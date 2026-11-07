import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UsersModule } from '../src/modules/users/users.module';
import { USERS_REPOSITORY } from '../src/modules/users/domain/repositories/users.repository.interface';
import { REFRESH_TOKENS_REPOSITORY } from '../src/modules/auth/domain/repositories/refresh-tokens.repository.interface';
import { USER_MEDIA_STATE_REPOSITORY } from '../src/modules/user-media/domain/repositories/user-media-state.repository.interface';
import { createE2eApp, createE2eTestingModule } from './support/e2e-testing-module';
import { OAUTH_ACCOUNTS_REPOSITORY } from '../src/modules/auth/domain/repositories/oauth-accounts.repository.interface';
import { InMemoryOAuthAccountsRepository } from './support/in-memory-oauth-accounts.repository';
import {
  InMemoryRefreshTokensRepository,
  InMemoryUserMediaRepository,
  InMemoryUsersRepository,
} from './users/_fakes';

describe('Auth hardening e2e', () => {
  let app: INestApplication;
  const baseUrl = '/api/auth';

  beforeAll(async () => {
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
      .compile();

    app = await createE2eApp(moduleFixture);
  });

  afterAll(async () => {
    await app.close();
  });

  const registerAndLogin = async () => {
    const email = `user${Date.now()}@example.com`;
    const username = `user${Date.now()}`;
    const password = 'S3curePassw0rd';

    await request(app.getHttpServer())
      .post(`${baseUrl}/register`)
      .send({ email, username, password })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post(`${baseUrl}/login`)
      .send({ email, password })
      .expect(200);

    return {
      email,
      password,
      accessToken: loginRes.body.data.accessToken as string,
      refreshToken: loginRes.body.data.refreshToken as string,
    };
  };

  it('/auth/me requires bearer and returns profile', async () => {
    await request(app.getHttpServer()).get(`${baseUrl}/me`).expect(401);

    const { accessToken } = await registerAndLogin();

    const meRes = await request(app.getHttpServer())
      .get(`${baseUrl}/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.email).toBeDefined();
  });

  it('refresh rotation: old refresh token becomes invalid after rotation', async () => {
    const { refreshToken } = await registerAndLogin();

    const firstRefresh = await request(app.getHttpServer())
      .post(`${baseUrl}/refresh`)
      .send({ refreshToken })
      .expect(201);

    const newRefresh = firstRefresh.body.data.refreshToken as string;

    // old token reuse should be rejected
    await request(app.getHttpServer())
      .post(`${baseUrl}/refresh`)
      .send({ refreshToken })
      .expect(401);

    // new token still works (rotation chain)
    const secondRefresh = await request(app.getHttpServer())
      .post(`${baseUrl}/refresh`)
      .send({ refreshToken: newRefresh })
      .expect(201);
    expect(secondRefresh.body.data.accessToken).toBeDefined();
  });

  it('reusing a revoked refresh token is rejected, rotated token remains valid', async () => {
    const { refreshToken } = await registerAndLogin();

    const firstRefresh = await request(app.getHttpServer())
      .post(`${baseUrl}/refresh`)
      .send({ refreshToken })
      .expect(201);

    const rotated = firstRefresh.body.data.refreshToken as string;

    // reuse old (already revoked) token -> 401
    await request(app.getHttpServer())
      .post(`${baseUrl}/refresh`)
      .send({ refreshToken })
      .expect(401);

    // rotated token still valid
    await request(app.getHttpServer())
      .post(`${baseUrl}/refresh`)
      .send({ refreshToken: rotated })
      .expect(201);
  });
});
