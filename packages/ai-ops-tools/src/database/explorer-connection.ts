import type { OpsLogger } from '../shared/ops-logger.port';

import { EXPLORER_URL_INVALID, type ExplorerPort } from './database.port';
import { PostgresExplorerAdapter } from './postgres.explorer-adapter';
import { UnconfiguredExplorerAdapter } from './unconfigured.explorer-adapter';

export type ClosableExplorerPort = ExplorerPort & { close?(): Promise<void> };

export const connectExplorer = (
  explorerDatabaseUrl: string | undefined,
  logger: OpsLogger,
): ClosableExplorerPort => {
  if (explorerDatabaseUrl === undefined) return new UnconfiguredExplorerAdapter();
  try {
    return PostgresExplorerAdapter.connect(explorerDatabaseUrl);
  } catch (error) {
    logger.warn(
      `db_schema and db_query are off: ${EXPLORER_URL_INVALID} (${error instanceof Error ? error.name : 'error'})`,
    );
    return new UnconfiguredExplorerAdapter(EXPLORER_URL_INVALID);
  }
};
