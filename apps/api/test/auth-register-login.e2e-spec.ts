import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UsersModule } from '../src/modules/users/users.module';
import { USERS_REPOSITORY } from '../src/modules/users/domain/repositories/users.repository.interface';
import { REFRESH_TOKENS_REPOSITORY } from '../src/modules/auth/domain/repositories/refresh-tokens.repository.interface';
import { OAUTH_ACCOUNTS_REPOSITORY } from '../src/modules/auth/domain/repositories/oauth-accounts.repository.interface';
import { USER_MEDIA_STATE_REPOSITORY } from '../src/modules/user-media/domain/repositories/user-media-state.repository.interface';
import { createE2eApp, createE2eTestingModule } from './support/e2e-testing-module';
import { InMemoryOAuthAccountsRepository } from './support/in-memory-oauth-accounts.repository';
import {
  InMemoryRefreshTokensRepository,
  InMemoryUserMediaRepository,
  InMemoryUsersRepository,
} from './users/_fakes';

describe('Auth e2e: register -> login -> refresh -> me', () => {
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

  it('should register then login successfully', async () => {
    const registerRes = await request(app.getHttpServer())
      .post(`${baseUrl}/register`)
      .send({
        email: 'user@example.com',
        username: 'tester',
        password: 'S3curePassw0rd',
      })
      .expect(201);

    expect(registerRes.body.success).toBe(true);
    expect(registerRes.body.data.accessToken).toBeDefined();
    expect(registerRes.body.data.refreshToken).toBeDefined();

    const loginRes = await request(app.getHttpServer())
      .post(`${baseUrl}/login`)
      .send({ email: 'user@example.com', password: 'S3curePassw0rd' })
      .expect(200);

    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.accessToken).toBeDefined();
    expect(loginRes.body.data.refreshToken).toBeDefined();
  });

  it('should fail validation on bad email/password', async () => {
    await request(app.getHttpServer())
      .post(`${baseUrl}/register`)
      .send({ email: 'bad', username: 'a', password: '123' })
      .expect(400);
  });

  it('should conflict on duplicate email', async () => {
    await request(app.getHttpServer())
      .post(`${baseUrl}/register`)
      .send({ email: 'dup@example.com', username: 'dup1', password: 'S3curePassw0rd' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`${baseUrl}/register`)
      .send({ email: 'dup@example.com', username: 'dup2', password: 'S3curePassw0rd' })
      .expect(409);
  });

  it('should reject login with wrong password', async () => {
    await request(app.getHttpServer())
      .post(`${baseUrl}/register`)
      .send({ email: 'wrongpass@example.com', username: 'wrongpass', password: 'S3curePassw0rd' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`${baseUrl}/login`)
      .send({ email: 'wrongpass@example.com', password: 'bad' })
      .expect(401);
  });

  it('should logout and revoke refresh token', async () => {
    const registerRes = await request(app.getHttpServer())
      .post(`${baseUrl}/register`)
      .send({ email: 'logout@example.com', username: 'logoutu', password: 'S3curePassw0rd' })
      .expect(201);

    const { accessToken, refreshToken } = registerRes.body.data;

    await request(app.getHttpServer())
      .post(`${baseUrl}/logout`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .post(`${baseUrl}/refresh`)
      .send({ refreshToken })
      .expect(401);
  });
});
