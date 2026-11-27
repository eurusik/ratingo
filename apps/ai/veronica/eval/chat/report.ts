import { asPercent, type CaseOutcome, type EvalSummary } from './aggregate';
import type { BaselineDiff, CaseChange } from './baseline';
import type { CalibrationReport, CalibrationVerdict } from './calibration';
import type { RunVerdict } from './scorer';

const ID_COLUMN_WIDTH = 30;
const COST_DECIMALS = 4;
const QUOTE_LIMIT = 90;

const clip = (text: string): string =>
  text.length > QUOTE_LIMIT ? `${text.slice(0, QUOTE_LIMIT - 1)}…` : text;

const describeFailure = (run: RunVerdict): string =>
  [
    ...(run.problem === null ? [] : [`could not be scored: ${clip(run.problem)}`]),
    ...(run.missingTools.length === 0 ? [] : [`missing tools: ${run.missingTools.join(', ')}`]),
    ...(run.forbiddenToolsCalled.length === 0
      ? []
      : [`forbidden tools called: ${run.forbiddenToolsCalled.join(', ')}`]),
    ...run.failedExpectations.map(
      (failed) => `${failed.id} «${clip(failed.text)}» — ${clip(failed.reason)}`,
    ),
    ...run.forbiddenHits.map((found) => `${found.kind}: «${clip(found.match)}»`),
    ...(run.wrongNumbers.length === 0 ? [] : [`wrong numbers: ${run.wrongNumbers.join(', ')}`]),
    ...(run.fellBack ? ['fell back to the raw snapshot'] : []),
  ].join('; ');

const stability = (outcome: CaseOutcome): string => {
  if (outcome.flaky) return 'FLAKY';
  return outcome.passed ? '' : 'stable';
};

export const renderCase = (outcome: CaseOutcome): string => {
  const head = [
    outcome.caseId.padEnd(ID_COLUMN_WIDTH),
    `${outcome.passes}/${outcome.runs.length}`,
    outcome.passed ? 'pass' : 'FAIL',
    stability(outcome),
  ]
    .join(' ')
    .trimEnd();
  const failures = outcome.runs.flatMap((run, index) =>
    run.passed ? [] : [`    run ${index + 1}: ${describeFailure(run)}`],
  );
  return [head, ...failures].join('\n');
};

const changeLine = (change: CaseChange): string => {
  const before = change.before === null ? 'new' : `${change.before.passes}/${change.before.runs}`;
  return `  ${change.caseId.padEnd(ID_COLUMN_WIDTH)} ${before} -> ${change.after.passes}/${change.after.runs}`;
};

const section = (title: string, lines: readonly string[]): string[] =>
  lines.length === 0 ? [] : [title, ...lines];

export const renderDiff = (diff: BaselineDiff): string => {
  const flakyFailures = diff.newlyFailing.filter((change) => change.after.flaky);
  return [
    ...section('NEW FAILURES (not flaky):', diff.regressions.map(changeLine)),
    ...section('newly failing but flaky:', flakyFailures.map(changeLine)),
    ...section('newly passing:', diff.newlyPassing.map(changeLine)),
    ...section('became flaky:', diff.becameFlaky.map(changeLine)),
    ...section('stopped being flaky:', diff.stoppedBeingFlaky.map(changeLine)),
    ...section('not in the baseline:', diff.newCases.map(changeLine)),
    ...section(
      'in the baseline but not run:',
      diff.removedCases.map((caseId) => `  ${caseId}`),
    ),
    ...(diff.regressions.length === 0 ? ['no new non-flaky failure against the baseline'] : []),
  ].join('\n');
};

const calibrationLine = (verdict: CalibrationVerdict): string =>
  `  ${verdict.item.id}: ${verdict.reasons.join(' | ') || 'no reason given'}`;

export const renderCalibration = (report: CalibrationReport): string =>
  [
    `judge agreement with the labelled answers: ${report.agreed}/${report.items} (${asPercent(report.agreement)})${report.trustworthy ? '' : ' — BELOW THE TRUST THRESHOLD, do not rely on this judge'}`,
    ...section('judge accepted a bad answer:', report.falsePasses.map(calibrationLine)),
    ...section('judge rejected a good answer:', report.falseFails.map(calibrationLine)),
    ...section('could not be judged:', report.unscorable.map(calibrationLine)),
    `calibration cost: $${report.costUsd.toFixed(COST_DECIMALS)}`,
  ].join('\n');

export interface SummaryContext {
  model: string;
  judgeModel: string;
  runs: number;
  passAt: number;
  agentCostUsd: number;
  judgeCostUsd: number;
  structureOnly: boolean;
  stoppedForCost: boolean;
}

export const renderSummary = (summary: EvalSummary, context: SummaryContext): string => {
  const totalCost = context.agentCostUsd + context.judgeCostUsd;
  return [
    `model: ${context.model}`,
    `judge: ${context.judgeModel}`,
    `each case ran ${context.runs} time(s) and passes at ${context.passAt}`,
    `cases: ${summary.cases}, runs: ${summary.runs}`,
    `pass rate: ${summary.passedCases}/${summary.cases} (${asPercent(summary.passRate)})`,
    `  stable pass: ${summary.stablePassed}, flaky pass: ${summary.flakyPassed}, flaky fail: ${summary.flakyFailed}, stable fail: ${summary.stableFailed}`,
    `tool selection rate (per run): ${asPercent(summary.toolSelectionRate)}`,
    `fact rate (per run): ${asPercent(summary.factRate)}`,
    `unknown questions answered honestly (per run): ${asPercent(summary.unknownAnsweredHonestly)}`,
    `answers with flagged numbers: ${summary.answersWithFlags} (${summary.flaggedNumbers} numbers, ${summary.wrongNumbers} wrong)`,
    `runs that fell back to the raw snapshot: ${summary.fallbacks}`,
    `runs that could not be scored: ${summary.unscorableRuns}`,
    `failed cases: ${summary.failedCases.join(', ') || 'none'}`,
    `flaky cases: ${summary.flakyCases.join(', ') || 'none'}`,
    `cost: $${totalCost.toFixed(COST_DECIMALS)} (agent $${context.agentCostUsd.toFixed(COST_DECIMALS)}, judge $${context.judgeCostUsd.toFixed(COST_DECIMALS)})`,
    ...(context.stoppedForCost
      ? ['STOPPED EARLY: the cost cap was reached, so the results above are incomplete']
      : []),
    context.structureOnly
      ? 'stub model replays the reference answers and a fake judge compares them: this checks the wiring, not the model'
      : 'real model: compare with the baseline before merging',
  ].join('\n');
};
