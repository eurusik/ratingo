import { z } from 'zod';

import type { CaseOutcome } from './aggregate';

export const BASELINE_VERSION = 1;

const baselineEntrySchema = z.object({
  passes: z.number().int().min(0),
  runs: z.number().int().min(1),
  passed: z.boolean(),
  flaky: z.boolean(),
});

const baselineSchema = z.object({
  version: z.literal(BASELINE_VERSION),
  savedAtMs: z.number().int(),
  model: z.string(),
  judgeModel: z.string(),
  runs: z.number().int().min(1),
  passAt: z.number().int().min(1),
  cases: z.record(z.string(), baselineEntrySchema),
});

export type BaselineEntry = z.infer<typeof baselineEntrySchema>;
export type Baseline = z.infer<typeof baselineSchema>;

export class InvalidBaselineError extends Error {
  constructor(reason: string) {
    super(`The baseline file is not usable: ${reason}`);
    this.name = 'InvalidBaselineError';
  }
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

export const parseBaseline = (json: string): Baseline => {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new InvalidBaselineError('it is not valid JSON');
  }
  const parsed = baselineSchema.safeParse(raw);
  if (!parsed.success) {
    throw new InvalidBaselineError(parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  return parsed.data;
};

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
    removedCases: Object.keys(baseline.cases).filter((caseId) => !present.has(caseId)),
    regressions: [...newlyFailing, ...newCases].filter(
      (change) => !change.after.passed && !change.after.flaky,
    ),
  };
};
