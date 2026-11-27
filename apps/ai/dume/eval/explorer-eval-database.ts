import { ExplorerEvalSession, type ExplorerExecutors } from '@ratingo/ai-ops-tools/testing';

import type { EvalCase, RuntimeFixture } from './eval-case';

export const explorerEval = new ExplorerEvalSession();

export const needsExplorerDatabase = (testCase: EvalCase): boolean =>
  testCase.runtime?.database !== undefined;

export const explorerExecutorsFor = (fixture: RuntimeFixture | undefined): ExplorerExecutors =>
  explorerEval.executorsFor(fixture?.database, 'a runtime fixture');
