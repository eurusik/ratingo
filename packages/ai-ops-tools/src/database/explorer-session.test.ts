import type postgres from 'postgres';

import { recordingLogger } from '../testing/recording-logger';

import { ExplorerSession } from './explorer-session';

const DEADLINE_MS = 1000;

const connectionFailing = (failing: string, error: Error): postgres.ReservedSql => {
  const unsafe = (statement: string): PromiseLike<unknown> =>
    statement === failing ? Promise.reject(error) : Promise.resolve([]);
  return { unsafe, release: () => undefined } as unknown as postgres.ReservedSql;
};

describe('ExplorerSession.reset', () => {
  it.each(['ROLLBACK', 'DISCARD ALL'])(
    'marks the session broken and logs why when %s fails',
    async (failing) => {
      const logger = recordingLogger();
      const session = new ExplorerSession(
        connectionFailing(failing, Object.assign(new Error('gone'), { code: '57P01' })),
        DEADLINE_MS,
        logger,
      );

      const reset = await session.reset();

      expect(reset).toBe(false);
      expect(session.reusable).toBe(false);
      expect(logger.warnings).toEqual([
        `the database explorer connection is replaced: ${failing} failed (connection_lost)`,
      ]);
    },
  );

  it('keeps a healthy session reusable and says nothing', async () => {
    const logger = recordingLogger();
    const session = new ExplorerSession(
      connectionFailing('never', new Error('x')),
      DEADLINE_MS,
      logger,
    );

    expect(await session.reset()).toBe(true);
    expect(session.reusable).toBe(true);
    expect(logger.warnings).toEqual([]);
  });
});
