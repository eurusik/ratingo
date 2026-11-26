import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { runWithLogContext } from '@ratingo/node-telemetry';

import { MAX_UPLOAD_FILE_SIZE_BYTES } from './common/constants';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { SlowRequestInterceptor } from './common/interceptors/slow-request.interceptor';
import { resolveCorsOrigins } from './config/allowed-origins';

const MAX_REQUEST_ID_LENGTH = 128;

const CORS_ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

const REQUEST_ID_HEADERS = ['x-request-id', 'x-railway-request-id'] as const;

const requestIdOf = (headers: Record<string, string | string[] | undefined>): string => {
  for (const name of REQUEST_ID_HEADERS) {
    const value = headers[name];
    if (typeof value === 'string' && value.length > 0) {
      return value.slice(0, MAX_REQUEST_ID_LENGTH);
    }
  }
  return randomUUID();
};

export const createHttpAdapter = (): FastifyAdapter =>
  new FastifyAdapter({
    trustProxy: true,
    genReqId: (request: IncomingMessage) => requestIdOf(request.headers),
  });

export function bindRequestIdToLogs(app: NestFastifyApplication): void {
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (request, reply, done) => {
      reply.header('x-request-id', request.id);
      runWithLogContext(
        {
          request_id: request.id,
          http_method: request.method,
          http_route: request.routeOptions.url || request.url.split('?')[0],
        },
        done,
      );
    });
}

export async function configureHttpApp(app: NestFastifyApplication): Promise<void> {
  bindRequestIdToLogs(app);
  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, { limits: { fileSize: MAX_UPLOAD_FILE_SIZE_BYTES } });

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
  app.useGlobalInterceptors(new SlowRequestInterceptor(), new ResponseInterceptor());
  app.enableCors({
    origin: resolveCorsOrigins(process.env),
    credentials: true,
    methods: CORS_ALLOWED_METHODS,
  });
}
