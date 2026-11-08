import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';

import { MAX_UPLOAD_FILE_SIZE_BYTES } from './common/constants';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { SlowRequestInterceptor } from './common/interceptors/slow-request.interceptor';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3002',
  'http://localhost:3000',
  'https://new.ratingo.top',
  'https://ratingo.top',
];

const CORS_ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

const corsOriginsFromEnv = (): string[] =>
  process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) ?? DEFAULT_CORS_ORIGINS;

export const createHttpAdapter = (): FastifyAdapter => new FastifyAdapter({ trustProxy: true });

export async function configureHttpApp(app: NestFastifyApplication): Promise<void> {
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
    origin: corsOriginsFromEnv(),
    credentials: true,
    methods: CORS_ALLOWED_METHODS,
  });
}
