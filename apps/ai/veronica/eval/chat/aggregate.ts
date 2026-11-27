import { EvalKind } from './eval-case';
import type { RunVerdict } from './scorer';

const PERCENT = 100;
const FIRST_RUN = 1;

export interface RepeatPolicy {
  runs: number;
  passAt: number;
}

export class InvalidRepeatPolicyError extends Error {
  constructor(policy: RepeatPolicy) {
    super(
      `Cannot pass at ${policy.passAt} of ${policy.runs} runs: use whole numbers with 1 <= passAt <= runs`,
    );
    this.name = 'InvalidRepeatPolicyError';
  }
}

export const assertRepeatPolicy = (policy: RepeatPolicy): void => {
  const whole = Number.isInteger(policy.runs) && Number.isInteger(policy.passAt);
  if (
    !whole ||
    policy.runs < FIRST_RUN ||
    policy.passAt < FIRST_RUN ||
    policy.passAt > policy.runs
  ) {
    throw new InvalidRepeatPolicyError(policy);
  }
};

export const majorityPassAt = (runs: number): number => Math.floor(runs / 2) + 1;

export interface CaseOutcome {
  caseId: string;
  kind: EvalKind;
  runs: readonly RunVerdict[];
  passes: number;
  passed: boolean;
  flaky: boolean;
}

export const aggregateCase = (
  caseId: string,
  kind: EvalKind,
  runs: readonly RunVerdict[],
  policy: RepeatPolicy,
): CaseOutcome => {
  const passes = runs.filter((run) => run.passed).length;
  return {
    caseId,
    kind,
    runs,
    passes,
    passed: passes >= policy.passAt,
    flaky: passes > 0 && passes < runs.length,
  };
};

export interface EvalSummary {
  cases: number;
  runs: number;
  passedCases: number;
  stablePassed: number;
  flakyPassed: number;
  flakyFailed: number;
  stableFailed: number;
  passRate: number;
  toolSelectionRate: number;
  factRate: number;
  unknownAnsweredHonestly: number | null;
  answersWithFlags: number;
  flaggedNumbers: number;
  wrongNumbers: number;
  fallbacks: number;
  unscorableRuns: number;
  failedCases: string[];
  flakyCases: string[];
}

const rate = (hits: number, total: number): number => (total === 0 ? 1 : hits / total);

const count = <T>(items: readonly T[], keep: (item: T) => boolean): number =>
  items.filter(keep).length;

const sum = (runs: readonly RunVerdict[], pick: (run: RunVerdict) => number): number =>
  runs.reduce((total, run) => total + pick(run), 0);

export const summarize = (outcomes: readonly CaseOutcome[]): EvalSummary => {
  const runs = outcomes.flatMap((outcome) => outcome.runs);
  const unknownRuns = runs.filter((run) => run.kind === EvalKind.UNKNOWN);
  return {
    cases: outcomes.length,
    runs: runs.length,
    passedCases: count(outcomes, (outcome) => outcome.passed),
    stablePassed: count(outcomes, (outcome) => outcome.passed && !outcome.flaky),
    flakyPassed: count(outcomes, (outcome) => outcome.passed && outcome.flaky),
    flakyFailed: count(outcomes, (outcome) => !outcome.passed && outcome.flaky),
    stableFailed: count(outcomes, (outcome) => !outcome.passed && !outcome.flaky),
    passRate: rate(
      count(outcomes, (outcome) => outcome.passed),
      outcomes.length,
    ),
    toolSelectionRate: rate(
      count(runs, (run) => run.toolsOk),
      runs.length,
    ),
    factRate: rate(
      count(runs, (run) => run.factsOk),
      runs.length,
    ),
    unknownAnsweredHonestly:
      unknownRuns.length === 0
        ? null
        : rate(
            count(unknownRuns, (run) => run.factsOk),
            unknownRuns.length,
          ),
    answersWithFlags: count(runs, (run) => run.flaggedNumbers.length > 0),
    flaggedNumbers: sum(runs, (run) => run.flaggedNumbers.length),
    wrongNumbers: sum(runs, (run) => run.wrongNumbers.length),
    fallbacks: count(runs, (run) => run.fellBack),
    unscorableRuns: count(runs, (run) => run.problem !== null),
    failedCases: outcomes.filter((outcome) => !outcome.passed).map((outcome) => outcome.caseId),
    flakyCases: outcomes.filter((outcome) => outcome.flaky).map((outcome) => outcome.caseId),
  };
};

export const asPercent = (value: number | null): string =>
  value === null ? 'n/a' : `${Math.round(value * PERCENT)}%`;
