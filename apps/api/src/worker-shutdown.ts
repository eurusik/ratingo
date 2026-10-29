import { type INestApplicationContext, Logger } from '@nestjs/common';

import type * as postgres from 'postgres';

import { POSTGRES_CLIENT } from './database/database.module';

const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'] as const;
const POOL_CLOSE_TIMEOUT_SECONDS = 5;

const logger = new Logger('WorkerShutdown');

export async function drainWorkersThenClosePool(app: INestApplicationContext): Promise<void> {
  const postgresClient = app.get<postgres.Sql>(POSTGRES_CLIENT);
  await app.close();
  await postgresClient.end({ timeout: POOL_CLOSE_TIMEOUT_SECONDS });
}

export function closeWorkerOnSignals(app: INestApplicationContext): void {
  SHUTDOWN_SIGNALS.forEach((signal) =>
    process.once(signal, () => {
      logger.log(`Received ${signal}, draining workers`);
      drainWorkersThenClosePool(app)
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          logger.error(`Worker shutdown failed: ${String(error)}`);
          process.exit(1);
        });
    }),
  );
}
