import { WorkerHost } from '@nestjs/bullmq';
import { type INestApplicationContext, Logger } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import type * as postgres from 'postgres';

import { POSTGRES_CLIENT } from './database/database.module';

const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'] as const;
const POOL_CLOSE_TIMEOUT_SECONDS = 5;
export const WORKER_DRAIN_TIMEOUT_MS = 25_000;

const logger = new Logger('WorkerShutdown');

const findBullWorkers = (app: INestApplicationContext) =>
  app
    .get(DiscoveryService, { strict: false })
    .getProviders()
    .map(({ instance }) => instance)
    .filter((instance): instance is WorkerHost => instance instanceof WorkerHost)
    .map((host) => host.worker);

const withDeadline = <T>(work: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: NodeJS.Timeout;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `Worker drain exceeded ${timeoutMs}ms; unfinished jobs are retried after the BullMQ stall check`,
          ),
        ),
      timeoutMs,
    );
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
};

export async function drainWorkersThenClosePool(
  app: INestApplicationContext,
  drainTimeoutMs = WORKER_DRAIN_TIMEOUT_MS,
): Promise<void> {
  const postgresClient = app.get<postgres.Sql>(POSTGRES_CLIENT);
  const workers = findBullWorkers(app);
  await withDeadline(Promise.all(workers.map((worker) => worker.close())), drainTimeoutMs);
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
          logger.error(
            `Worker shutdown failed: ${String(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
          process.exit(1);
        });
    }),
  );
}
