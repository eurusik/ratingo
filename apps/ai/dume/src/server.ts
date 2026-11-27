import 'reflect-metadata';
import { telemetrySdk } from './telemetry/register';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { SERVICE_CONFIG, type ServiceConfig } from './config/config.constants';
import { InvestigationWorker } from './modules/investigation-requests/application/workers/investigation.worker';
import { INVESTIGATION_QUEUE } from './modules/investigation-requests/domain/ports/investigation-queue.port';
import { MAX_BODY_BYTES } from './modules/investigation-requests/investigation-requests.constants';
import { BullmqInvestigationQueue } from './modules/investigation-requests/infrastructure/queue/bullmq-investigation-queue';
import { runShutdown } from './shutdown';
import { createAppLogger } from './telemetry/app-logger';

const appLogger = createAppLogger();
Logger.overrideLogger(appLogger);

const LISTEN_HOST = '::';
const SIGNALS: readonly NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

const shutdownAfterSignal = (app: NestFastifyApplication): void => {
  let started = false;
  const stop = (signal: string): void => {
    if (started) return;
    started = true;
    const shutdownLogger = new Logger('Shutdown');
    shutdownLogger.log({ message: 'shutdown.started', signal });
    void runShutdown(
      [
        { name: 'worker', run: () => app.get(InvestigationWorker).close() },
        {
          name: 'queue',
          run: () => app.get<BullmqInvestigationQueue>(INVESTIGATION_QUEUE).close(),
        },
        { name: 'app', run: () => app.close() },
        { name: 'telemetry', run: async () => telemetrySdk?.shutdown() },
        { name: 'logs', run: () => appLogger.flush() },
      ],
      shutdownLogger,
    ).then(() => process.exit(0));
  };
  for (const signal of SIGNALS) process.once(signal, () => stop(signal));
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: MAX_BODY_BYTES }),
    { logger: appLogger },
  );
  const { port } = app.get<ServiceConfig>(SERVICE_CONFIG);
  await app.listen(port, LISTEN_HOST);
  shutdownAfterSignal(app);
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
