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

  it('writes one json line per call without colour codes when deployed', () => {
    createAppLogger({ RAILWAY_ENVIRONMENT_NAME: 'production' }).log(
      { message: 'ai.run.finished', runId: 'run-1', costUsd: 0.01 },
      'Run',
    );

    const [[line]] = stdout.mock.calls;
    expect(String(line)).not.toContain('\u001b[');
    expect(JSON.parse(String(line))).toMatchObject({
      level: 'info',
      service: 'ratingo-veronica',
      environment: 'production',
      context: 'Run',
      message: 'ai.run.finished',
      run_id: 'run-1',
      cost_usd: 0.01,
    });
  });
});
