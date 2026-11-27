export interface ShutdownStep {
  name: string;
  run: () => Promise<unknown>;
}

export interface ShutdownLog {
  log(entry: Record<string, unknown>): void;
  warn(entry: Record<string, unknown>): void;
}

export const runShutdown = async (
  steps: readonly ShutdownStep[],
  logger: ShutdownLog,
): Promise<void> => {
  for (const step of steps) {
    try {
      await step.run();
      logger.log({ message: 'shutdown.step_done', step: step.name });
    } catch (error) {
      logger.warn({
        message: 'shutdown.step_failed',
        step: step.name,
        reason: error instanceof Error ? error.name : 'error',
      });
    }
  }
};
