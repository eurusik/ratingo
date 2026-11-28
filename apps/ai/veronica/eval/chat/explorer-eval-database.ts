import { ExplorerEvalSession, type ExplorerExecutors } from '@ratingo/ai-ops-tools/testing';

import type { EvalCase } from './eval-case';

export const explorerEval = new ExplorerEvalSession();

export const needsExplorerDatabase = (testCase: EvalCase): boolean =>
  testCase.database !== undefined;

export const explorerExecutorsFor = (testCase: EvalCase): ExplorerExecutors =>
  explorerEval.executorsFor(testCase.database, testCase.id);
