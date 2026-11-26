import { type INestApplication, Logger } from '@nestjs/common';

import { exitAfter } from './common/runtime/exit-after';
import { withTimeout } from './common/utils/with-timeout.util';

const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'] as const;
const HTTP_SHUTDOWN_TIMEOUT_MS = 25_000;

const logger = new Logger('HttpShutdown');

export async function shutdownHttp(app: INestApplication): Promise<void> {
  await app.getHttpAdapter().close();
  await app.close();
}

export function closeHttpOnSignals(
  app: INestApplication,
  flushLogs: () => Promise<void>,
  timeoutMs = HTTP_SHUTDOWN_TIMEOUT_MS,
): void {
  let shutdown: Promise<void> | undefined;

  const onSignal = (signal: NodeJS.Signals) => {
    if (shutdown !== undefined) {
      logger.warn(`Received ${signal} while already shutting down`);
      return;
    }
    logger.log(`Received ${signal}, closing the HTTP server before the providers`);
    shutdown = exitAfter(
      withTimeout(
        shutdownHttp(app),
        timeoutMs,
        `HTTP shutdown exceeded ${timeoutMs}ms; open connections are dropped`,
      ),
      flushLogs,
      logger,
      'HTTP shutdown failed',
    );
  };

  SHUTDOWN_SIGNALS.forEach((signal) => process.on(signal, onSignal));
}
