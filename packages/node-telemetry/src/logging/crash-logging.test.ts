import { installCrashLogging } from './crash-logging';
import { createStructuredLogger } from './create-structured-logger';

describe('installCrashLogging', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });

  it('logs the error with its stack, flushes and exits with code 1', async () => {
    const handlers: Record<string, (error: unknown) => void> = {};
    jest.spyOn(process, 'on').mockImplementation(((
      event: string,
      handler: (error: unknown) => void,
    ) => {
      handlers[event] = handler;
      return process;
    }) as typeof process.on);
    const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const lines: string[] = [];
    const logger = createStructuredLogger(
      { identity: { service: 'api', environment: 'production' }, format: 'json', minLevel: 'info' },
      { write: (line) => void lines.push(line) },
    );

    installCrashLogging(logger);
    handlers.uncaughtException(new TypeError('boom'));
    await new Promise((resolve) => setImmediate(resolve));

    expect(JSON.parse(lines[0])).toMatchObject({
      level: 'error',
      message: 'Uncaught exception',
      context: 'Process',
      error_name: 'TypeError',
    });
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('also covers unhandled promise rejections', () => {
    const events: string[] = [];
    jest.spyOn(process, 'on').mockImplementation(((event: string) => {
      events.push(event);
      return process;
    }) as typeof process.on);

    installCrashLogging(
      createStructuredLogger(
        {
          identity: { service: 'api', environment: 'production' },
          format: 'json',
          minLevel: 'info',
        },
        { write: () => undefined },
      ),
    );

    expect(events).toEqual(['uncaughtException', 'unhandledRejection']);
  });
});
