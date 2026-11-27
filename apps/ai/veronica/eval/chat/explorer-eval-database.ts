import { join } from 'node:path';

import { ExplorerEvalSession, type ExplorerExecutors } from '@ratingo/ai-ops-tools/testing';

import type { EvalCase } from './eval-case';

const MIGRATIONS_FOLDER = join(__dirname, '../../../../api/drizzle_v2');

const session = new ExplorerEvalSession(MIGRATIONS_FOLDER);

export const startExplorerEvalDatabase = (adminUrl: string): Promise<void> =>
  session.start(adminUrl);

export const stopExplorerEvalDatabase = (): Promise<void> => session.stop();

export const needsExplorerDatabase = (testCase: EvalCase): boolean =>
  testCase.database !== undefined;

export const explorerExecutorsFor = (testCase: EvalCase): ExplorerExecutors =>
  session.executorsFor(testCase.database, testCase.id);
