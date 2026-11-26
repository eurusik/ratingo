import type { StructuredLogger } from './structured-logger';

const CRASH_EXIT_CODE = 1;

export function installCrashLogging(logger: StructuredLogger): void {
  const crash = (message: string) => (error: unknown) => {
    logger.error(message, { context: 'Process', error });
    void logger.flush().finally(() => process.exit(CRASH_EXIT_CODE));
  };
  process.on('uncaughtException', crash('Uncaught exception'));
  process.on('unhandledRejection', crash('Unhandled promise rejection'));
}
