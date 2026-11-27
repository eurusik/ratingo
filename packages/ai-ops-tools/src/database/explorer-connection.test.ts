import { recordingLogger } from '../testing/recording-logger';

import { connectExplorer } from './explorer-connection';

describe('connectExplorer', () => {
  it('runs without the tool, says why and does not crash when the URL is malformed', async () => {
    const logger = recordingLogger();

    const explorer = connectExplorer('not a connection string', logger);

    await expect(explorer.schema()).rejects.toThrow(
      'AI_EXPLORER_DATABASE_URL is not a valid connection string',
    );
    expect(logger.warnings).toHaveLength(1);
    expect(logger.warnings[0]).not.toContain('not a connection string');
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
