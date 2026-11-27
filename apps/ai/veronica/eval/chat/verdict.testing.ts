import { aggregateCase, majorityPassAt, type CaseOutcome } from './aggregate';
import { EvalKind } from './eval-case';
import type { RunVerdict } from './scorer';

export const passingRun = (overrides: Partial<RunVerdict> = {}): RunVerdict => ({
  caseId: 'case',
  kind: EvalKind.KNOWN,
  answer: 'answer',
  calledKeys: [],
  toolsOk: true,
  missingTools: [],
  forbiddenToolsCalled: [],
  meaningOk: true,
  failedExpectations: [],
  forbiddenHits: [],
  flaggedNumbers: [],
  wrongNumbers: [],
  falseFlags: [],
  fellBack: false,
  problem: null,
  factsOk: true,
  passed: true,
  ...overrides,
});

export const failingRun = (overrides: Partial<RunVerdict> = {}): RunVerdict =>
  passingRun({ meaningOk: false, factsOk: false, passed: false, ...overrides });

export const runsWithPasses = (passes: number, total: number): RunVerdict[] =>
  Array.from({ length: total }, (_, index) => (index < passes ? passingRun() : failingRun()));

const DEFAULT_RUNS = 3;

export const outcomeWithPasses = (
  caseId: string,
  passes: number,
  runs: number = DEFAULT_RUNS,
): CaseOutcome =>
  aggregateCase(caseId, EvalKind.KNOWN, runsWithPasses(passes, runs), {
    runs,
    passAt: majorityPassAt(runs),
  });
