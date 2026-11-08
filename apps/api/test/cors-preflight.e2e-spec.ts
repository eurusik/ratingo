import { Controller, Delete, type INestApplication, Patch, Put } from '@nestjs/common';
import * as request from 'supertest';

import { createE2eApp, createE2eTestingModule } from './support/e2e-testing-module';

const WEB_CLIENT_ORIGIN = 'https://ratingo.top';
const PROBE_PATH = '/api/cors-probe';

@Controller('cors-probe')
class CorsProbeController {
  @Patch()
  patch(): void {}

  @Put()
  put(): void {}

  @Delete()
  remove(): void {}
}

describe('CORS preflight e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await createE2eTestingModule({
      controllers: [CorsProbeController],
    }).compile();
    app = await createE2eApp(moduleFixture);
  });

  afterAll(async () => {
    await app.close();
  });

  const preflight = (method: string) =>
    request(app.getHttpServer())
      .options(PROBE_PATH)
      .set('Origin', WEB_CLIENT_ORIGIN)
      .set('Access-Control-Request-Method', method)
      .set('Access-Control-Request-Headers', 'authorization,content-type');

  it.each(['PATCH', 'PUT', 'DELETE'])(
    'allows a cross-origin %s from the web client',
    async (method) => {
      const response = await preflight(method).expect(204);

      const allowedMethods = String(response.headers['access-control-allow-methods']).split(
        /\s*,\s*/,
      );
      expect(allowedMethods).toEqual(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
      expect(response.headers['access-control-allow-origin']).toBe(WEB_CLIENT_ORIGIN);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    },
  );

  it('does not allow an unknown origin', async () => {
    const response = await request(app.getHttpServer())
      .options(PROBE_PATH)
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'PATCH');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
