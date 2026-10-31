import { WorkerHost } from '@nestjs/bullmq';
import { type INestApplicationContext } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { type Worker } from 'bullmq';

import { POSTGRES_CLIENT } from './database/database.module';
import { closeWorkerOnSignals, shutdownWorker } from './worker-shutdown';

class FakeProcessor extends WorkerHost {
  constructor(private readonly fakeWorker: Pick<Worker, 'close'>) {
    super();
  }

  get worker(): Worker {
    return this.fakeWorker as Worker;
  }

  async process(): Promise<void> {}
}

const NEVER = () => new Promise<void>(() => undefined);

const buildApp = (
  calls: string[],
  {
    workerClose = async () => void calls.push('worker.close'),
    appClose = async () => undefined,
  } = {},
) => {
  const postgresClient = { end: jest.fn(async () => void calls.push('pool.end')) };
  const discovery = {
    getProviders: () => [{ instance: new FakeProcessor({ close: workerClose }) }, { instance: {} }],
  };
  const app = {
    get: jest.fn((token: unknown) => {
      if (token === POSTGRES_CLIENT) return postgresClient;
      if (token === DiscoveryService) return discovery;
      return undefined;
    }),
    close: jest.fn(async () => {
      calls.push('app.close');
      await appClose();
    }),
  } as unknown as INestApplicationContext;
  return { app, postgresClient };
};

describe('shutdownWorker', () => {
  it('drains BullMQ workers before closing the context and ending the postgres pool', async () => {
    const calls: string[] = [];
    const { app, postgresClient } = buildApp(calls);

    await shutdownWorker(app);

    expect(calls).toEqual(['worker.close', 'app.close', 'pool.end']);
    expect(postgresClient.end).toHaveBeenCalledWith({ timeout: 5 });
  });

  it('gives up during the drain without tearing down resources under running jobs', async () => {
    const calls: string[] = [];
    const { app } = buildApp(calls, { workerClose: NEVER });

    await expect(shutdownWorker(app, 10)).rejects.toThrow(/exceeded 10ms/);
    expect(calls).toEqual([]);
  });

  it('bounds the context close by the same deadline', async () => {
    const calls: string[] = [];
    const { app } = buildApp(calls, { appClose: NEVER });

    await expect(shutdownWorker(app, 10)).rejects.toThrow(/exceeded 10ms/);
    expect(calls).toEqual(['worker.close', 'app.close']);
  });
});

describe('closeWorkerOnSignals', () => {
  const signals = ['SIGTERM', 'SIGINT'] as const;
  let listenersBefore: Map<string, NodeJS.SignalsListener[]>;

  beforeEach(() => {
    listenersBefore = new Map(signals.map((signal) => [signal, process.listeners(signal)]));
    jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    signals.forEach((signal) =>
      process
        .listeners(signal)
        .filter((listener) => !listenersBefore.get(signal).includes(listener))
        .forEach((listener) => process.removeListener(signal, listener)),
    );
    jest.restoreAllMocks();
  });

  it('runs a single shutdown when several signals arrive', async () => {
    const calls: string[] = [];
    const { app } = buildApp(calls);
    closeWorkerOnSignals(app);

    process.emit('SIGTERM');
    process.emit('SIGINT');
    process.emit('SIGTERM');
    await new Promise(setImmediate);

    expect(app.close).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(0);
  });
});
