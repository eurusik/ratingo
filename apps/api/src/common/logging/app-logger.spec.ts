import { createAppLogger } from './app-logger';

describe('createAppLogger', () => {
  let stdout: jest.SpyInstance;

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(process, 'on').mockImplementation(() => process);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const lines = () => stdout.mock.calls.map(([line]) => String(line));

  it('writes json with the role service name and the Railway environment when deployed', () => {
    createAppLogger({ RAILWAY_ENVIRONMENT_NAME: 'production', APP_ROLE: 'worker' }).log(
      '[job:sync_1] Processing sync',
      'SyncWorker',
    );

    expect(JSON.parse(lines()[0])).toMatchObject({
      level: 'info',
      service: 'ratingo-worker',
      environment: 'production',
      context: 'SyncWorker',
      message: 'Processing sync',
      job_id: 'sync_1',
    });
  });

  it('drops debug output when deployed and keeps it locally', () => {
    createAppLogger({ RAILWAY_ENVIRONMENT_NAME: 'production' }).debug('hidden', 'Ctx');
    expect(lines()).toHaveLength(0);

    createAppLogger({}).debug('shown', 'Ctx');
    expect(lines()).toHaveLength(1);
  });

  it('writes readable text without colour codes locally', () => {
    createAppLogger({}).warn('slow query', 'Db');

    expect(lines()[0]).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3} WARN {2}\[Db\] slow query\n$/);
  });
});
