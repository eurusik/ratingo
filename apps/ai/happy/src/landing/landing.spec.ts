import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import fc from 'fast-check';

import { WEBHOOK_CONFIG } from '../config/config.constants';
import { HealthModule } from '../health/health.module';
import { WebhookService } from '../modules/webhook/application/services/webhook.service';
import { GithubWebhookController } from '../modules/webhook/presentation/controllers/github-webhook.controller';

import { LandingModule } from './landing.module';

const NEUTRAL_BODY = '{"statusCode":404,"message":"Not Found"}';

const createApp = async (): Promise<NestFastifyApplication> => {
  const moduleRef = await Test.createTestingModule({
    imports: [HealthModule, LandingModule],
    controllers: [GithubWebhookController],
    providers: [
      { provide: WEBHOOK_CONFIG, useValue: { secret: 'a-long-enough-webhook-secret' } },
      { provide: WebhookService, useValue: { handle: jest.fn() } },
    ],
  }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    rawBody: true,
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
};

describe('Happy public surface', () => {
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
    expect(response.body).toContain('Happy · On Duty');
    expect(response.body).not.toContain('class="subtitle"');
    expect(response.body).toContain('src="data:image/jpeg;base64,');
    expect(response.body).not.toContain('<script');
  });

  it('keeps /health unchanged', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('still rejects a webhook with a bad signature', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/github',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=bad' },
      payload: '{}',
    });
    expect(response.statusCode).toBe(401);
  });

  it.each([
    ['GET', '/nope'],
    ['POST', '/'],
    ['POST', '/health'],
    ['GET', '/webhooks/github'],
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
