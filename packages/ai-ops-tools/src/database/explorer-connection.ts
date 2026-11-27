import type { OpsLogger } from '../shared/ops-logger.port';

import { EXPLORER_URL_INVALID, type ExplorerPort } from './database.port';
import { PostgresExplorerAdapter } from './postgres.explorer-adapter';
import { UnconfiguredExplorerAdapter } from './unconfigured.explorer-adapter';

export type ClosableExplorerPort = ExplorerPort & { close?(): Promise<void> };

const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

const explorerUrlProblem = (explorerDatabaseUrl: string): string | null => {
  let url: URL;
  try {
    url = new URL(explorerDatabaseUrl);
  } catch {
    return 'it is not a URL';
  }
  if (!POSTGRES_PROTOCOLS.has(url.protocol))
    return 'it does not start with postgres:// or postgresql://';
  if (url.hostname === '') return 'it has no host';
  if (url.pathname.length <= 1) return 'it has no database name';
  return null;
};

export const connectExplorer = (
  explorerDatabaseUrl: string | undefined,
  logger: OpsLogger,
): ClosableExplorerPort => {
  if (explorerDatabaseUrl === undefined) return new UnconfiguredExplorerAdapter();
  const problem = explorerUrlProblem(explorerDatabaseUrl);
  if (problem !== null) {
    logger.warn(`db_schema and db_query are off: ${EXPLORER_URL_INVALID} (${problem})`);
    return new UnconfiguredExplorerAdapter(EXPLORER_URL_INVALID);
  }
  return PostgresExplorerAdapter.connect(explorerDatabaseUrl);
};
