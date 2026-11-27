import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import type { CaseOutcome } from './aggregate';

const BASELINE_VERSION = 1 as const;
const JSON_INDENT = 2;
const MIN_LOST_PASSES = 2;
const NOT_FOUND_CODE = 'ENOENT';

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

export type BaselineContext = Omit<Baseline, 'version' | 'cases'>;

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

export const RegressionReason = {
  STOPPED_PASSING: 'stopped passing',
  LOST_PASSES: 'lost passes',
  NEW_CASE_FAILS: 'new case fails',
} as const;
export type RegressionReason = (typeof RegressionReason)[keyof typeof RegressionReason];

export interface CaseChange {
  caseId: string;
  before: BaselineEntry | null;
  after: BaselineEntry;
}

interface Regression extends CaseChange {
  reason: RegressionReason;
}

export interface BaselineDiff {
  newlyFailing: CaseChange[];
  newlyPassing: CaseChange[];
  becameFlaky: CaseChange[];
  stoppedBeingFlaky: CaseChange[];
  newCases: CaseChange[];
  removedCases: string[];
  regressions: Regression[];
}

const stoppedPassing = (before: BaselineEntry, after: BaselineEntry): boolean =>
  before.passed && !after.passed && (!before.flaky || !after.flaky);

const lostTooManyPasses = (before: BaselineEntry, after: BaselineEntry): boolean =>
  !before.flaky &&
  before.passes * after.runs - after.passes * before.runs >= MIN_LOST_PASSES * before.runs;

const regressionOf = (change: CaseChange): Regression | null => {
  const { before, after } = change;
  if (before === null) {
    return !after.passed && !after.flaky
      ? { ...change, reason: RegressionReason.NEW_CASE_FAILS }
      : null;
  }
  if (stoppedPassing(before, after)) return { ...change, reason: RegressionReason.STOPPED_PASSING };
  return lostTooManyPasses(before, after)
    ? { ...change, reason: RegressionReason.LOST_PASSES }
    : null;
};

const isKnown = (change: CaseChange): change is CaseChange & { before: BaselineEntry } =>
  change.before !== null;

export const diffBaseline = (
  baseline: Baseline,
  outcomes: readonly CaseOutcome[],
  options: { fullRun: boolean },
): BaselineDiff => {
  const changes = outcomes.map((outcome): CaseChange => ({
    caseId: outcome.caseId,
    before: baseline.cases[outcome.caseId] ?? null,
    after: entryOf(outcome),
  }));
  const known = changes.filter(isKnown);
  const present = new Set(outcomes.map((outcome) => outcome.caseId));
  return {
    newlyFailing: known.filter((change) => change.before.passed && !change.after.passed),
    newlyPassing: known.filter((change) => !change.before.passed && change.after.passed),
    becameFlaky: known.filter((change) => !change.before.flaky && change.after.flaky),
    stoppedBeingFlaky: known.filter((change) => change.before.flaky && !change.after.flaky),
    newCases: changes.filter((change) => change.before === null),
    removedCases: options.fullRun
      ? Object.keys(baseline.cases).filter((caseId) => !present.has(caseId))
      : [],
    regressions: changes
      .map(regressionOf)
      .filter((regression): regression is Regression => regression !== null),
  };
};

export const readBaselineFile = async (file: string): Promise<Baseline | null> => {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as Baseline;
    if (parsed.version !== BASELINE_VERSION)
      throw new Error(`Unsupported baseline version ${String(parsed.version)} in ${file}`);
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === NOT_FOUND_CODE) return null;
    throw error;
  }
};

export const writeBaselineFile = async (file: string, baseline: Baseline): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(baseline, null, JSON_INDENT)}\n`);
};
