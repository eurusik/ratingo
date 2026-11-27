import { join } from 'node:path';

import {
  ExplorerEvalRuntime,
  missingExplorerDatabaseExecutors,
  unconfiguredExplorerExecutors,
  type ExplorerExecutors,
} from '@ratingo/ai-ops-tools';

import type { EvalCase } from './eval-case';

export const EXPLORER_EVAL_DATABASE_VARIABLE = 'EXPLORER_EVAL_DATABASE_URL';

const MIGRATIONS_FOLDER = join(__dirname, '../../../../api/drizzle_v2');

let running: ExplorerEvalRuntime | null = null;

export const startExplorerEvalDatabase = async (adminUrl: string): Promise<void> => {
  if (running !== null) return;
  running = await ExplorerEvalRuntime.start({ adminUrl, migrationsFolder: MIGRATIONS_FOLDER });
};

export const stopExplorerEvalDatabase = async (): Promise<void> => {
  const current = running;
  running = null;
  await current?.close();
};

export const needsExplorerDatabase = (testCase: EvalCase): boolean =>
  testCase.database !== undefined;

export const explorerExecutorsFor = (testCase: EvalCase): ExplorerExecutors => {
  if (testCase.database === undefined) return unconfiguredExplorerExecutors();
  if (running === null) {
    return missingExplorerDatabaseExecutors(
      `Case ${testCase.id} needs ${EXPLORER_EVAL_DATABASE_VARIABLE}`,
    );
  }
  return running.executors(testCase.database);
};
