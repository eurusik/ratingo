import { type INestApplicationContext, Logger } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import type * as postgres from 'postgres';

import { findBullWorkers } from './common/runtime/bull-workers';
import { withTimeout } from './common/utils/with-timeout.util';
import { POSTGRES_CLIENT } from './database/database.module';

const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'] as const;
const POOL_CLOSE_TIMEOUT_SECONDS = 5;
export const WORKER_SHUTDOWN_TIMEOUT_MS = 25_000;

const logger = new Logger('WorkerShutdown');

async function drainWorkersThenClose(app: INestApplicationContext): Promise<void> {
  const postgresClient = app.get<postgres.Sql>(POSTGRES_CLIENT);
  const workers = findBullWorkers(app.get(DiscoveryService, { strict: false }));
  await Promise.all(workers.map((worker) => worker.close()));
  await app.close();
  await postgresClient.end({ timeout: POOL_CLOSE_TIMEOUT_SECONDS });
}

export const shutdownWorker = (
  app: INestApplicationContext,
  timeoutMs = WORKER_SHUTDOWN_TIMEOUT_MS,
): Promise<void> =>
  withTimeout(
    drainWorkersThenClose(app),
    timeoutMs,
    `Worker shutdown exceeded ${timeoutMs}ms; unfinished jobs are retried after the BullMQ stall check`,
  );

const exitAfter = (shutdown: Promise<void>): Promise<void> =>
  shutdown
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logger.error(
        `Worker shutdown failed: ${String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      process.exit(1);
    });

export function closeWorkerOnSignals(app: INestApplicationContext): void {
  let shutdown: Promise<void> | undefined;

  const onSignal = (signal: NodeJS.Signals) => {
    if (shutdown) {
      logger.warn(`Received ${signal} while already shutting down`);
      return;
    }
    logger.log(`Received ${signal}, draining workers`);
    shutdown = exitAfter(shutdownWorker(app));
  };

  SHUTDOWN_SIGNALS.forEach((signal) => process.on(signal, onSignal));
}
