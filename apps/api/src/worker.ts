import './common/runtime/load-env';
import './common/runtime/default-worker-role';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { getAppRole } from './common/runtime/app-role';
import { WorkerAppModule } from './worker-app.module';
import { closeWorkerOnSignals } from './worker-shutdown';

const logger = new Logger('Worker');

async function bootstrap(): Promise<void> {
  const role = getAppRole();
  if (role !== 'worker') {
    throw new Error(`worker entrypoint requires APP_ROLE=worker, got APP_ROLE=${role}`);
  }

  const app = await NestFactory.createApplicationContext(WorkerAppModule);
  closeWorkerOnSignals(app);
  logger.log('Worker is running (APP_ROLE=worker)');
}

bootstrap().catch((error: unknown) => {
  logger.error(`Worker failed to start: ${String(error)}`);
  process.exit(1);
});
