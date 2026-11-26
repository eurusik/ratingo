import 'reflect-metadata';
import './telemetry/register';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { INFRA_CONFIG, type InfraConfig } from './config/config.constants';
import { createAppLogger } from './telemetry/app-logger';

const appLogger = createAppLogger();
Logger.overrideLogger(appLogger);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: appLogger,
  });
  app.enableShutdownHooks();
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onClose', () => appLogger.flush());
  const { port } = app.get<InfraConfig>(INFRA_CONFIG);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`Veronica слухає порт ${port}`);
}

bootstrap().catch(async (error: unknown) => {
  new Logger('Bootstrap').error(
    error instanceof Error ? error.message : 'Veronica failed to start',
    error instanceof Error ? error.stack : undefined,
  );
  await appLogger.flush();
  process.exit(1);
});
