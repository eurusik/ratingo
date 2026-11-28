import { FixedClock } from '@ratingo/ai-core';

import { createOpsRuntime } from './ops-runtime.factory';

const mockFailuresClose = jest.fn();
const mockExplorerClose = jest.fn();

jest.mock('@ratingo/ai-ops-tools', () => ({
  ...jest.requireActual<Record<string, unknown>>('@ratingo/ai-ops-tools'),
  PostgresJobFailuresAdapter: { connect: () => ({ close: mockFailuresClose }) },
  connectExplorer: () => ({ close: mockExplorerClose }),
}));

const CLOCK = new FixedClock(1_000_000);
const CONFIG = {
  loki: {},
  prometheus: {},
  readerDatabaseUrl: 'postgres://reader@localhost/db',
  explorerDatabaseUrl: 'postgres://explorer@localhost/db',
};

describe('createOpsRuntime close', () => {
  beforeEach(() => {
    mockFailuresClose.mockReset();
    mockExplorerClose.mockReset();
  });

  it('still closes the explorer when closing the job failures reader fails, and rethrows the first failure', async () => {
    mockFailuresClose.mockRejectedValue(new Error('reader stuck'));
    mockExplorerClose.mockResolvedValue(undefined);

    await expect(createOpsRuntime(CONFIG, CLOCK).close()).rejects.toThrow('reader stuck');

    expect(mockExplorerClose).toHaveBeenCalledTimes(1);
  });

  it('wraps a rejection that is not an error', async () => {
    mockFailuresClose.mockResolvedValue(undefined);
    mockExplorerClose.mockRejectedValue('plain text');

    await expect(createOpsRuntime(CONFIG, CLOCK).close()).rejects.toThrow('plain text');
  });
});
