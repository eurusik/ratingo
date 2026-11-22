import 'reflect-metadata';
import './telemetry/register';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { INFRA_CONFIG, type InfraConfig } from './config/config.constants';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.enableShutdownHooks();
  const { port } = app.get<InfraConfig>(INFRA_CONFIG);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`Veronica слухає порт ${port}`);
}

void bootstrap();
