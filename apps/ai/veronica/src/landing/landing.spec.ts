import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import fc from 'fast-check';

import { HealthModule } from '../health/health.module';

import { LandingModule } from './landing.module';

const NEUTRAL_BODY = '{"statusCode":404,"message":"Not Found"}';

const createApp = async (): Promise<NestFastifyApplication> => {
  const moduleRef = await Test.createTestingModule({
    imports: [HealthModule, LandingModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    rawBody: true,
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
};

describe('Veronica public surface', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the landing page at / with strict headers and no scripts', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.headers['cache-control']).toBe('public, max-age=300');
    expect(response.headers['content-security-policy']).toBe(
      "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.body).toContain('Veronica');
    expect(response.body).not.toContain('class="subtitle"');
    expect(response.body).toContain('src="data:image/jpeg;base64,');
    expect(response.body).not.toContain('<script');
  });

  it('keeps /health unchanged', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it.each([
    ['GET', '/nope'],
    ['POST', '/'],
    ['POST', '/health'],
    ['GET', '/webhooks/telegram'],
  ] as const)('answers %s %s with the neutral 404', async (method, url) => {
    const response = await app.inject({ method, url });
    expect(response.statusCode).toBe(404);
    expect(response.body).toBe(NEUTRAL_BODY);
  });

  it('never echoes an unknown path in the 404 body', async () => {
    const segment = fc.stringMatching(/^[a-z0-9]{4,24}$/).filter((value) => value !== 'health');
    await fc.assert(
      fc.asyncProperty(fc.array(segment, { minLength: 1, maxLength: 4 }), async (segments) => {
        const path = `/x-${segments.join('/')}`;
        const response = await app.inject({ method: 'GET', url: path });
        expect(response.statusCode).toBe(404);
        expect(response.body).toBe(NEUTRAL_BODY);
        for (const part of segments) {
          expect(response.body).not.toContain(part);
        }
      }),
      { numRuns: 50 },
    );
  });
});
