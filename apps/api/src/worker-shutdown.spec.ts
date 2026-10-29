import { WorkerHost } from '@nestjs/bullmq';
import { type INestApplicationContext } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { POSTGRES_CLIENT } from './database/database.module';
import { drainWorkersThenClosePool } from './worker-shutdown';

class FakeProcessor extends WorkerHost {
  constructor(close: () => Promise<void>) {
    super();
    Object.assign(this, { _worker: { close } });
  }
  async process(): Promise<void> {}
}

const buildApp = (calls: string[], workerClose: () => Promise<void>) => {
  const postgresClient = { end: jest.fn(async () => void calls.push('pool.end')) };
  const discovery = {
    getProviders: () => [{ instance: new FakeProcessor(workerClose) }, { instance: {} }],
  };
  const app = {
    get: jest.fn((token: unknown) => {
      if (token === POSTGRES_CLIENT) return postgresClient;
      if (token === DiscoveryService) return discovery;
      return undefined;
    }),
    close: jest.fn(async () => void calls.push('app.close')),
  } as unknown as INestApplicationContext;
  return { app, postgresClient };
};

describe('drainWorkersThenClosePool', () => {
  it('drains BullMQ workers before closing the context and ending the postgres pool', async () => {
    const calls: string[] = [];
    const { app, postgresClient } = buildApp(calls, async () => void calls.push('worker.close'));

    await drainWorkersThenClosePool(app);

    expect(calls).toEqual(['worker.close', 'app.close', 'pool.end']);
    expect(postgresClient.end).toHaveBeenCalledWith({ timeout: 5 });
  });

  it('gives up after the drain deadline without tearing down resources under running jobs', async () => {
    const calls: string[] = [];
    const { app } = buildApp(calls, () => new Promise<void>(() => undefined));

    await expect(drainWorkersThenClosePool(app, 10)).rejects.toThrow(/exceeded 10ms/);
    expect(calls).toEqual([]);
  });
});
