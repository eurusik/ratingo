import { runShutdown, type ShutdownLog } from './shutdown';

const silentLog = (): ShutdownLog & { entries: Record<string, unknown>[] } => {
  const entries: Record<string, unknown>[] = [];
  return {
    entries,
    log: (entry) => void entries.push(entry),
    warn: (entry) => void entries.push(entry),
  };
};

describe('runShutdown', () => {
  it('runs the steps in the order given, each after the one before has finished', async () => {
    const order: string[] = [];
    const step = (name: string, delayMs: number) => ({
      name,
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        order.push(name);
      },
    });

    await runShutdown(
      [step('worker', 20), step('queue', 5), step('app', 1), step('telemetry', 0), step('logs', 0)],
      silentLog(),
    );

    expect(order).toEqual(['worker', 'queue', 'app', 'telemetry', 'logs']);
  });

  it('goes on with the later steps when one fails, and says which and why', async () => {
    const order: string[] = [];
    const logger = silentLog();

    await runShutdown(
      [
        { name: 'worker', run: async () => void order.push('worker') },
        {
          name: 'queue',
          run: async () => {
            throw new TypeError('closed twice');
          },
        },
        { name: 'logs', run: async () => void order.push('logs') },
      ],
      logger,
    );

    expect(order).toEqual(['worker', 'logs']);
    expect(logger.entries).toContainEqual({
      message: 'shutdown.step_failed',
      step: 'queue',
      reason: 'TypeError',
    });
  });
});
