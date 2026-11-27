import 'reflect-metadata';
import './telemetry/register';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { SERVICE_CONFIG, type ServiceConfig } from './config/config.constants';
import { MAX_BODY_BYTES } from './modules/investigation-requests/investigation-requests.constants';
import { createAppLogger } from './telemetry/app-logger';

const appLogger = createAppLogger();
Logger.overrideLogger(appLogger);

const LISTEN_HOST = '::';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: MAX_BODY_BYTES }),
    { logger: appLogger },
  );
  app.enableShutdownHooks();
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onClose', () => appLogger.flush());
  const { port } = app.get<ServiceConfig>(SERVICE_CONFIG);
  await app.listen(port, LISTEN_HOST);
  new Logger('Bootstrap').log(`DUM-E listening on port ${port}`);
}

bootstrap().catch(async (error: unknown) => {
  new Logger('Bootstrap').error(
    error instanceof Error ? error.message : 'DUM-E failed to start',
    error instanceof Error ? error.stack : undefined,
  );
  await appLogger.flush();
  process.exit(1);
});
