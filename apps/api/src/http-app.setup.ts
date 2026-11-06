import { ValidationPipe } from '@nestjs/common';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';

import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';

import { MAX_UPLOAD_FILE_SIZE_BYTES } from './common/constants';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { SlowRequestInterceptor } from './common/interceptors/slow-request.interceptor';

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
}
