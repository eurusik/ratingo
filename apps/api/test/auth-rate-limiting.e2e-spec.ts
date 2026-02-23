import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as request from 'supertest';

import { ConfigModule } from '@nestjs/config';
import authConfig from '../src/config/auth.config';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { DATABASE_CONNECTION } from '../src/database/database.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { REFRESH_TOKENS_REPOSITORY } from '../src/modules/auth/domain/repositories/refresh-tokens.repository.interface';
import { EXCHANGE_CODES_REPOSITORY } from '../src/modules/auth/domain/repositories/exchange-codes.repository.interface';
import { OAUTH_ACCOUNTS_REPOSITORY } from '../src/modules/auth/domain/repositories/oauth-accounts.repository.interface';
import { USER_MEDIA_STATE_REPOSITORY } from '../src/modules/user-media/domain/repositories/user-media-state.repository.interface';
import { USERS_REPOSITORY } from '../src/modules/users/domain/repositories/users.repository.interface';
import { UsersModule } from '../src/modules/users/users.module';
import {
  InMemoryRefreshTokensRepository,
  InMemoryUserMediaRepository,
  InMemoryUsersRepository,
} from './users/_fakes';
import type {
  ExchangeCodeRecord,
  IExchangeCodesRepository,
} from '../src/modules/auth/domain/repositories/exchange-codes.repository.interface';

// ─── In-memory Exchange Codes Repository ──────────────────────────────────────

class InMemoryExchangeCodesRepository implements IExchangeCodesRepository {
  private records: ExchangeCodeRecord[] = [];

  async create(
    data: Omit<ExchangeCodeRecord, 'id' | 'usedAt' | 'createdAt'>,
  ): Promise<ExchangeCodeRecord> {
    const record: ExchangeCodeRecord = {
      ...data,
      id: `exc-${this.records.length + 1}`,
      usedAt: null,
      createdAt: new Date(),
    };
    this.records.push(record);
    return record;
  }

  async consumeCode(codeHash: string) {
    const record = this.records.find(
      (r) => r.codeHash === codeHash && !r.usedAt && r.expiresAt > new Date(),
    );
    if (!record) return { success: false as const, reason: 'not_found' as const };
    record.usedAt = new Date();
    return { success: true as const, record };
  }

  async cleanupExpired(): Promise<number> {
    return 0;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_URL = '/api/auth';

async function createThrottledApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [authConfig], ignoreEnvFile: true }),
      EventEmitterModule.forRoot(),
      ThrottlerModule.forRoot({
        throttlers: [
          { name: 'default', ttl: 60_000, limit: 600 },
          { name: 'strict', ttl: 60_000, limit: 120 },
        ],
      }),
      AuthModule,
      UsersModule,
    ],
    // Use base ThrottlerGuard (proper per-route key generation) to validate
    // that @Throttle decorators on auth routes are correctly applied.
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  })
    .overrideProvider(USERS_REPOSITORY)
    .useClass(InMemoryUsersRepository)
    .overrideProvider(REFRESH_TOKENS_REPOSITORY)
    .useClass(InMemoryRefreshTokensRepository)
    .overrideProvider(USER_MEDIA_STATE_REPOSITORY)
    .useClass(InMemoryUserMediaRepository)
    .overrideProvider(EXCHANGE_CODES_REPOSITORY)
    .useClass(InMemoryExchangeCodesRepository)
    .overrideProvider(OAUTH_ACCOUNTS_REPOSITORY)
    .useValue({})
    .overrideProvider(DATABASE_CONNECTION)
    .useValue({})
    .compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.init();
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Auth Rate Limiting (e2e)', () => {
  describe('POST /auth/register — @Throttle limit: 10', () => {
    let app: INestApplication;
    let server: ReturnType<INestApplication['getHttpServer']>;

    beforeAll(async () => {
      app = await createThrottledApp();
      server = app.getHttpServer();
    }, 30_000);

    afterAll(async () => {
      await app.close();
    });

    it('should allow 10 requests and return 429 on the 11th', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(server)
          .post(`${BASE_URL}/register`)
          .send({
            email: `rate_reg_${i}@test.com`,
            username: `rate_reg_${i}`,
            password: 'S3curePassw0rd',
          });
        expect(res.status).toBe(201);
      }

      // 11th request should be rate limited
      const blocked = await request(server).post(`${BASE_URL}/register`).send({
        email: 'rate_overflow@test.com',
        username: 'rate_overflow',
        password: 'S3curePassw0rd',
      });

      expect(blocked.status).toBe(429);
      expect(blocked.body.success).toBe(false);
      expect(blocked.body.error.code).toBe('RATE_LIMITED');
      expect(blocked.headers['retry-after']).toBeDefined();
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    });
  });

  describe('POST /auth/oauth/exchange — @Throttle limit: 10', () => {
    let app: INestApplication;
    let server: ReturnType<INestApplication['getHttpServer']>;

    beforeAll(async () => {
      app = await createThrottledApp();
      server = app.getHttpServer();
    }, 30_000);

    afterAll(async () => {
      await app.close();
    });

    it('should allow 10 requests and return 429 on the 11th', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(server)
          .post(`${BASE_URL}/oauth/exchange`)
          .send({ code: `invalid-code-${i}` });
        expect(res.status).not.toBe(429);
      }

      const blocked = await request(server)
        .post(`${BASE_URL}/oauth/exchange`)
        .send({ code: 'invalid-code-overflow' });

      expect(blocked.status).toBe(429);
    });
  });

  // Note: POST /auth/refresh has @Throttle({ default: { limit: 30 } }).
  // Not tested here because jwtService.verify() on invalid tokens is slow in test env.
  // The @Throttle mechanism is validated by register and exchange tests above.

  describe('Cross-endpoint isolation', () => {
    let app: INestApplication;
    let server: ReturnType<INestApplication['getHttpServer']>;

    beforeAll(async () => {
      app = await createThrottledApp();
      server = app.getHttpServer();
    }, 30_000);

    afterAll(async () => {
      await app.close();
    });

    it('throttling register should not affect exchange endpoint', async () => {
      // Exhaust register limit
      for (let i = 0; i < 11; i++) {
        await request(server)
          .post(`${BASE_URL}/register`)
          .send({
            email: `iso_${i}@test.com`,
            username: `iso_${i}`,
            password: 'S3curePassw0rd',
          });
      }

      // Verify register is throttled
      const regRes = await request(server).post(`${BASE_URL}/register`).send({
        email: 'iso_blocked@test.com',
        username: 'iso_blocked',
        password: 'S3curePassw0rd',
      });
      expect(regRes.status).toBe(429);

      // Exchange should still work (separate counter)
      const exchRes = await request(server)
        .post(`${BASE_URL}/oauth/exchange`)
        .send({ code: 'invalid-code' });
      expect(exchRes.status).not.toBe(429);
    });
  });
});
