import { join } from 'node:path';

import { ExplorerEvalSession, type ExplorerExecutors } from '@ratingo/ai-ops-tools/testing';

import type { EvalCase, RuntimeFixture } from './eval-case';

const MIGRATIONS_FOLDER = join(__dirname, '../../../api/drizzle_v2');

const session = new ExplorerEvalSession(MIGRATIONS_FOLDER);

export const startExplorerEvalDatabase = (adminUrl: string): Promise<void> =>
  session.start(adminUrl);

export const stopExplorerEvalDatabase = (): Promise<void> => session.stop();

export const needsExplorerDatabase = (testCase: EvalCase): boolean =>
  testCase.runtime?.database !== undefined;

export const explorerExecutorsFor = (fixture: RuntimeFixture | undefined): ExplorerExecutors =>
  session.executorsFor(fixture?.database, 'a runtime fixture');
