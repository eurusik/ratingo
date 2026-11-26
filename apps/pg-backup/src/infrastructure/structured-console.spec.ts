import { redactSecrets, StructuredConsole } from './structured-console';

const SETTINGS = { service: 'ratingo-backup', environment: 'production' };
const NOW = new Date('2026-11-26T03:17:00.500Z');

function setup(otlpEndpoint?: string, fetchImpl: jest.Mock = jest.fn()) {
  const lines: string[] = [];
  const logger = new StructuredConsole(
    { ...SETTINGS, otlpEndpoint },
    {
      write: (line) => void lines.push(line),
      now: () => NOW,
      fetchImpl,
      sleep: () => Promise.resolve(),
    },
  );
  return { logger, lines, fetchImpl };
}

describe('StructuredConsole', () => {
  it('writes one JSON line per call with the shared log shape', () => {
    const { logger, lines } = setup();

    logger.log('Uploaded backup-1.dump after 1 attempt(s)');
    logger.warn('Upload attempt 1/6 failed');
    logger.error('Backup failed: timeout');

    expect(lines.map((line) => JSON.parse(line))).toEqual([
      {
        time: '2026-11-26T03:17:00.500Z',
        level: 'info',
        service: 'ratingo-backup',
        environment: 'production',
        context: 'backup',
        message: 'Uploaded backup-1.dump after 1 attempt(s)',
      },
      expect.objectContaining({ level: 'warn' }),
      expect.objectContaining({ level: 'error', message: 'Backup failed: timeout' }),
    ]);
    expect(lines.every((line) => line.endsWith('\n') && !line.slice(0, -1).includes('\n'))).toBe(
      true,
    );
  });

  it('keeps a multi-line stack inside one record', () => {
    const { logger, lines } = setup();
    const error = new Error('spawn failed');
    error.stack = 'Error: spawn failed\n    at run (a.js:1:1)';

    logger.error('pg_dump crashed', error);

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).message).toContain('at run (a.js:1:1)');
  });

  it('redacts connection strings, keys and addresses before writing', () => {
    const { logger, lines } = setup();

    logger.warn(
      'pg_dump: could not connect to postgres://backup:s3cretPass@db.internal:5432/app; AWS_SECRET_ACCESS_KEY=abcd1234efgh5678 owner ops@example.com',
    );

    expect(lines[0]).not.toContain('s3cretPass');
    expect(lines[0]).not.toContain('abcd1234efgh5678');
    expect(lines[0]).not.toContain('ops@example.com');
    expect(lines[0]).toContain('db.internal:5432/app');
  });

  it('flushes all lines in one OTLP request to /v1/logs', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const { logger } = setup('http://alloy.railway.internal:4318/', fetchImpl);

    logger.log('one');
    logger.error('two');
    await logger.flush();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('http://alloy.railway.internal:4318/v1/logs');
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    const records = body.resourceLogs[0].scopeLogs[0].logRecords;
    expect(records.map((record: { severityText: string }) => record.severityText)).toEqual([
      'info',
      'error',
    ]);
    expect(JSON.parse(records[1].body.stringValue)).toMatchObject({ message: 'two' });
    expect(records[0].timeUnixNano).toBe('1795663020500000000');
  });

  it('retries a failing export and reports a lost batch on stdout', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response(null, { status: 503 }));
    const { logger, lines } = setup('http://alloy:4318', fetchImpl);

    logger.error('Backup failed');
    await logger.flush();

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last).toMatchObject({
      level: 'warn',
      message: 'Log export failed: HTTP 503',
      lostRecords: 1,
    });
  });

  it('does nothing on flush without an endpoint', async () => {
    const fetchImpl = jest.fn();
    const { logger } = setup(undefined, fetchImpl);

    logger.log('x');
    await logger.flush();

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('redactSecrets', () => {
  it('leaves ordinary progress text alone', () => {
    const text = 'Dumped database to backup-2026-11-26.dump: 812.4 MB';

    expect(redactSecrets(text)).toBe(text);
  });
});
