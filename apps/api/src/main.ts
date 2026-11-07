import './common/runtime/load-env';
import './telemetry/register';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule } from '@nestjs/swagger';

import { createAppLogger } from './common/logging/app-logger';
import { getAppRole, runsHttp } from './common/runtime/app-role';
import { DevTiming } from './common/utils/dev-timing';
import { errorMessage } from './common/utils/error.utils';
import { configureHttpApp, createHttpAdapter } from './http-app.setup';
import { applyStandardErrorResponses, buildSwaggerConfig } from './swagger.config';
import { registerHttpMetrics } from './telemetry/http-metrics';

const logger = new Logger('Bootstrap');

/**
 * Entry point of the API application.
 * Initializes NestJS with Fastify adapter and sets up Swagger documentation.
 *
 * @returns {Promise<void>}
 */
async function bootstrap(): Promise<void> {
  const role = getAppRole();
  if (!runsHttp(role)) {
    throw new Error(
      `HTTP entrypoint cannot run with APP_ROLE=${role}; start dist/src/worker.js instead`,
    );
  }

  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, createHttpAdapter(), {
    logger: createAppLogger(),
  });

  registerHttpMetrics(app.getHttpAdapter().getInstance());

  await configureHttpApp(app);

  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3002',
      'http://localhost:3000',
      'https://new.ratingo.top',
      'https://ratingo.top',
    ],
    credentials: true,
  });

  // Swagger Documentation Setup (shared config — see swagger.config.ts)
  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
  applyStandardErrorResponses(document);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      docExpansion: 'none', // collapse all groups — the tag list is the navigation
      filter: true, // search box over tags/operations
      persistAuthorization: true, // keep the Bearer token across page reloads
      defaultModelsExpandDepth: 0, // hide the schemas wall at the bottom
    },
  });

  // Start server
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);

  // Start event loop lag monitor (controlled by DevTiming)
  DevTiming.startEventLoopMonitor();
}

bootstrap().catch((error: unknown) => {
  logger.error(
    `Application failed to start: ${errorMessage(error)}`,
    error instanceof Error ? error.stack : undefined,
  );
  process.exit(1);
});
