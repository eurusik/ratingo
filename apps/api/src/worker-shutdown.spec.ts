import { type INestApplicationContext } from '@nestjs/common';

import { POSTGRES_CLIENT } from './database/database.module';
import { drainWorkersThenClosePool } from './worker-shutdown';

describe('drainWorkersThenClosePool', () => {
  it('closes the Nest context, draining BullMQ workers, before ending the postgres pool', async () => {
    const calls: string[] = [];
    const postgresClient = { end: jest.fn(async () => void calls.push('pool.end')) };
    const app = {
      get: jest.fn((token: unknown) => (token === POSTGRES_CLIENT ? postgresClient : undefined)),
      close: jest.fn(async () => void calls.push('app.close')),
    } as unknown as INestApplicationContext;

    await drainWorkersThenClosePool(app);

    expect(calls).toEqual(['app.close', 'pool.end']);
    expect(postgresClient.end).toHaveBeenCalledWith({ timeout: 5 });
  });
});
