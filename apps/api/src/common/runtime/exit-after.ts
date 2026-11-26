import { type Logger } from '@nestjs/common';

import { errorMessage } from '../utils/error.utils';

export const exitAfter = (
  shutdown: Promise<void>,
  flushLogs: () => Promise<void>,
  logger: Logger,
  failureMessage: string,
): Promise<void> =>
  shutdown
    .then(() => flushLogs())
    .then(() => process.exit(0))
    .catch(async (error: unknown) => {
      logger.error(
        `${failureMessage}: ${errorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      await flushLogs();
      process.exit(1);
    });
