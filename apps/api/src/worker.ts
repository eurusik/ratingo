import './common/runtime/load-env';
import './telemetry/register';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { createAppLogger } from './common/logging/app-logger';
import { type AppRole, getAppRole } from './common/runtime/app-role';
import { errorMessage } from './common/utils/error.utils';
import { closeWorkerOnSignals } from './worker-shutdown';

const WORKER_ROLE: AppRole = 'worker';

const appLogger = createAppLogger();
Logger.overrideLogger(appLogger);

const logger = new Logger('Worker');

async function bootstrap(): Promise<void> {
  process.env.APP_ROLE ||= WORKER_ROLE;
  const role = getAppRole();
  if (role !== WORKER_ROLE) {
    throw new Error(`worker entrypoint requires APP_ROLE=worker, got APP_ROLE=${role}`);
  }

  const { WorkerAppModule } = await import('./worker-app.module');
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    logger: appLogger,
  });
  closeWorkerOnSignals(app, () => appLogger.flush());
  logger.log('Worker is running (APP_ROLE=worker)');
}

bootstrap().catch(async (error: unknown) => {
  logger.error(
    `Worker failed to start: ${errorMessage(error)}`,
    error instanceof Error ? error.stack : undefined,
  );
  await appLogger.flush();
  process.exit(1);
});
