import { HEALTH_CHECK_TIMEOUT_MS } from './health.constants';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const createService = (
    overrides: { execute?: jest.Mock; ping?: jest.Mock; status?: string } = {},
  ) => {
    const execute = overrides.execute ?? jest.fn().mockResolvedValue([]);
    const ping = overrides.ping ?? jest.fn().mockResolvedValue('PONG');
    const db = { execute } as any;
    const queue = { client: Promise.resolve({ ping, status: overrides.status ?? 'ready' }) } as any;
    return { service: new HealthService(db, queue), execute, ping };
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports ok when database and redis respond', async () => {
    const { service, execute, ping } = createService();

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'up', redis: 'up' },
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('reports database down when the query fails', async () => {
    const { service } = createService({
      execute: jest.fn().mockRejectedValue(new Error('connection refused')),
    });

    await expect(service.check()).resolves.toEqual({
      status: 'error',
      checks: { database: 'down', redis: 'up' },
    });
  });

  it('reports redis down when ping fails', async () => {
    const { service } = createService({
      ping: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    });

    await expect(service.check()).resolves.toEqual({
      status: 'error',
      checks: { database: 'up', redis: 'down' },
    });
  });

  it('reports redis down without pinging when the connection is not ready', async () => {
    const { service, ping } = createService({ status: 'reconnecting' });

    await expect(service.check()).resolves.toEqual({
      status: 'error',
      checks: { database: 'up', redis: 'down' },
    });
    expect(ping).not.toHaveBeenCalled();
  });

  it('reports a dependency down when it does not answer in time', async () => {
    jest.useFakeTimers();
    const { service } = createService({ execute: jest.fn(() => new Promise(() => undefined)) });

    const result = service.check();
    await jest.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS);

    await expect(result).resolves.toEqual({
      status: 'error',
      checks: { database: 'down', redis: 'up' },
    });
  });
});
