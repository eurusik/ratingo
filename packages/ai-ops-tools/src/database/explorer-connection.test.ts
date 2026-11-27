import { recordingLogger } from '../testing/recording-logger';

import { connectExplorer } from './explorer-connection';

describe('connectExplorer', () => {
  it('runs without the tool, says why and does not crash when the URL is malformed', async () => {
    const logger = recordingLogger();

    const explorer = connectExplorer('not a connection string', logger);

    await expect(explorer.schema()).rejects.toThrow(
      'AI_EXPLORER_DATABASE_URL is not a valid connection string',
    );
    expect(logger.warnings).toEqual([
      'db_schema and db_query are off: AI_EXPLORER_DATABASE_URL is not a valid connection string (it is not a URL)',
    ]);
  });

  it.each([
    ['mysql://user:secret@localhost/db', 'it does not start with postgres:// or postgresql://'],
    ['postgres://user:secret@localhost', 'it has no database name'],
    ['postgres:///db', 'it has no host'],
  ])('says which part of %s is wrong and never prints the value', async (url, problem) => {
    const logger = recordingLogger();

    const explorer = connectExplorer(url, logger);

    await expect(explorer.schema()).rejects.toThrow('not a valid connection string');
    expect(logger.warnings).toEqual([
      `db_schema and db_query are off: AI_EXPLORER_DATABASE_URL is not a valid connection string (${problem})`,
    ]);
    expect(logger.warnings.join(' ')).not.toContain('secret');
  });

  it('runs without the tool and without a log line when the URL is not set', async () => {
    const logger = recordingLogger();

    const explorer = connectExplorer(undefined, logger);

    await expect(explorer.schema()).rejects.toThrow('AI_EXPLORER_DATABASE_URL is not set');
    expect(logger.warnings).toEqual([]);
  });

  it('connects lazily for a well-formed URL', async () => {
    const explorer = connectExplorer('postgres://user:secret@localhost:1/db', recordingLogger());

    await expect(explorer.close?.()).resolves.toBeUndefined();
  });
});
