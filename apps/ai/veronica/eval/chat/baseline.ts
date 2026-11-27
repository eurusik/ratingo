import type { CaseOutcome } from './aggregate';

export const BASELINE_VERSION = 1 as const;

export interface BaselineEntry {
  passes: number;
  runs: number;
  passed: boolean;
  flaky: boolean;
}

export interface Baseline {
  version: typeof BASELINE_VERSION;
  savedAtMs: number;
  model: string;
  judgeModel: string;
  runs: number;
  passAt: number;
  cases: Record<string, BaselineEntry>;
}

export interface BaselineContext {
  model: string;
  judgeModel: string;
  runs: number;
  passAt: number;
  savedAtMs: number;
}

const entryOf = (outcome: CaseOutcome): BaselineEntry => ({
  passes: outcome.passes,
  runs: outcome.runs.length,
  passed: outcome.passed,
  flaky: outcome.flaky,
});

export const buildBaseline = (
  outcomes: readonly CaseOutcome[],
  context: BaselineContext,
): Baseline => ({
  version: BASELINE_VERSION,
  ...context,
  cases: Object.fromEntries(outcomes.map((outcome) => [outcome.caseId, entryOf(outcome)])),
});

export interface CaseChange {
  caseId: string;
  before: BaselineEntry | null;
  after: BaselineEntry;
}

export interface BaselineDiff {
  newlyFailing: CaseChange[];
  newlyPassing: CaseChange[];
  becameFlaky: CaseChange[];
  stoppedBeingFlaky: CaseChange[];
  newCases: CaseChange[];
  removedCases: string[];
  regressions: CaseChange[];
}

const changeOf = (baseline: Baseline, outcome: CaseOutcome): CaseChange => ({
  caseId: outcome.caseId,
  before: baseline.cases[outcome.caseId] ?? null,
  after: entryOf(outcome),
});

const isKnown = (change: CaseChange): change is CaseChange & { before: BaselineEntry } =>
  change.before !== null;

export const diffBaseline = (
  baseline: Baseline,
  outcomes: readonly CaseOutcome[],
  options: { fullRun: boolean } = { fullRun: true },
): BaselineDiff => {
  const changes = outcomes.map((outcome) => changeOf(baseline, outcome));
  const known = changes.filter(isKnown);
  const newCases = changes.filter((change) => change.before === null);
  const newlyFailing = known.filter((change) => change.before.passed && !change.after.passed);
  const present = new Set(outcomes.map((outcome) => outcome.caseId));
  return {
    newlyFailing,
    newlyPassing: known.filter((change) => !change.before.passed && change.after.passed),
    becameFlaky: known.filter((change) => !change.before.flaky && change.after.flaky),
    stoppedBeingFlaky: known.filter((change) => change.before.flaky && !change.after.flaky),
    newCases,
    removedCases: options.fullRun
      ? Object.keys(baseline.cases).filter((caseId) => !present.has(caseId))
      : [],
    regressions: [...newlyFailing, ...newCases].filter(
      (change) => !change.after.passed && !change.after.flaky,
    ),
  };
};
