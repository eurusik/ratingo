import { Controller, Get } from '@nestjs/common';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { getLogContext } from '@ratingo/node-telemetry';

import { bindRequestIdToLogs, createHttpAdapter } from './http-app.setup';

@Controller('probe')
class ProbeController {
  @Get()
  read(): Record<string, string | number | boolean> {
    return getLogContext();
  }
}

describe('request id in logs', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(createHttpAdapter());
    bindRequestIdToLogs(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('uses the incoming x-request-id for the log context and echoes it back', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/probe',
      headers: { 'x-request-id': 'edge-123' },
    });

    expect(JSON.parse(response.body)).toEqual({
      request_id: 'edge-123',
      http_method: 'GET',
      http_route: '/probe',
    });
    expect(response.headers['x-request-id']).toBe('edge-123');
  });

  it('falls back to the Railway edge request id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/probe',
      headers: { 'x-railway-request-id': 'rw-9' },
    });

    expect(JSON.parse(response.body)).toMatchObject({ request_id: 'rw-9' });
  });

  it('generates an id when the request has none and gives each request its own', async () => {
    const first = await app.inject({ method: 'GET', url: '/probe' });
    const second = await app.inject({ method: 'GET', url: '/probe' });

    const firstId = JSON.parse(first.body).request_id as string;
    const secondId = JSON.parse(second.body).request_id as string;
    expect(firstId).toMatch(/^[0-9a-f-]{36}$/);
    expect(secondId).not.toBe(firstId);
  });

  it('keeps the query string, which may carry OAuth codes, out of the route', async () => {
    const response = await app.inject({ method: 'GET', url: '/probe?code=secret-oauth-code' });

    expect(response.body).not.toContain('secret-oauth-code');
  });

  it('falls back to the path for routes that do not exist', async () => {
    const response = await app.inject({ method: 'GET', url: '/missing?x=1' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('truncates absurdly long ids', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/probe',
      headers: { 'x-request-id': 'a'.repeat(500) },
    });

    expect(JSON.parse(response.body).request_id).toHaveLength(128);
  });
});
