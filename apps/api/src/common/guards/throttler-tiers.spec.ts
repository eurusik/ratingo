import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';

import * as request from 'supertest';

import { buildThrottlerTiers, ThrottlerRealIpGuard } from './throttler-realip.guard';

/**
 * Exercises the production tiers + guard against real @nestjs/throttler semantics:
 * module-level skipIf is applied even when a route overrides that tier via @Throttle().
 */
@Controller('probe')
class ProbeController {
  @Post('auth')
  @Throttle({ auth: { limit: 3, ttl: 60000 } })
  authRoute() {
    return { ok: true };
  }

  @Post('auth-other')
  @Throttle({ auth: { limit: 3, ttl: 60000 } })
  otherAuthRoute() {
    return { ok: true };
  }

  @Post('refresh')
  @Throttle({ refresh: { limit: 2, ttl: 60000 } })
  refreshRoute() {
    return { ok: true };
  }

  // Previous (broken) pattern: overriding the 'default' tier on a mutation route
  @Post('legacy-default')
  @Throttle({ default: { limit: 1, ttl: 60000 } })
  legacyDefaultRoute() {
    return { ok: true };
  }

  @Post('plain')
  plainRoute() {
    return { ok: true };
  }

  @Get('read')
  readRoute() {
    return { ok: true };
  }
}

describe('Throttler tiers (real @nestjs/throttler semantics)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot({ throttlers: buildThrottlerTiers(600) })],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerRealIpGuard }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('applies the opted-in auth limit to a POST route (429 after the limit)', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 3; i++) {
      await request(server).post('/probe/auth').expect(201);
    }
    await request(server).post('/probe/auth').expect(429);
  });

  it('counts auth-tier routes separately', async () => {
    await request(app.getHttpServer()).post('/probe/auth-other').expect(201);
  });

  it('applies the refresh tier independently of the auth tier', async () => {
    const server = app.getHttpServer();
    await request(server).post('/probe/refresh').expect(201);
    await request(server).post('/probe/refresh').expect(201);
    await request(server).post('/probe/refresh').expect(429);
  });

  it('documents the bug: @Throttle({ default }) on a mutation route is ignored', async () => {
    const server = app.getHttpServer();
    await request(server).post('/probe/legacy-default').expect(201);
    await request(server).post('/probe/legacy-default').expect(201);
  });

  it('does not apply auth/refresh tiers to routes that did not opt in', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 5; i++) {
      await request(server).post('/probe/plain').expect(201);
    }
    await request(server).get('/probe/read').expect(200);
  });
});
