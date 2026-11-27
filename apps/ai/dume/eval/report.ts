import { asPercent, type CaseOutcome, type EvalSummary } from './aggregate';
import type { BaselineDiff, CaseChange } from './baseline';

const COST_DECIMALS = 4;
const AVERAGE_DECIMALS = 1;

export const renderCase = (outcome: CaseOutcome): string => {
  const status = outcome.passed ? 'pass' : 'FAIL';
  const stability = outcome.flaky ? 'FLAKY' : 'stable';
  const lines = [`${status} ${stability} ${outcome.passes}/${outcome.runs.length}  ${outcome.caseId}`];
  outcome.runs.forEach((run, index) => {
    if (run.passed) return;
    const reasons = run.problem === null ? run.failures : [`could not be scored: ${run.problem}`, ...run.failures];
    lines.push(`    run ${index + 1}: ${reasons.join(' | ')}`);
  });
  return lines.join('\n');
};

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

export const renderSummary = (summary: EvalSummary, context: SummaryContext): string =>
  [
    `model ${context.model}, judge ${context.judgeModel}, ${context.runs} runs per case, pass at ${context.passAt}`,
    context.structureOnly ? 'structure only: the stub model replays each reference, nothing here says how a real model does' : '',
    `cases passed: ${summary.passedCases}/${summary.cases} (${asPercent(summary.passRate)}); stable pass ${summary.stablePassed}, flaky pass ${summary.flakyPassed}, flaky fail ${summary.flakyFailed}, stable fail ${summary.stableFailed}`,
    summary.flakyCases.length > 0 ? `flaky: ${summary.flakyCases.join(', ')}` : '',
    summary.failedCases.length > 0 ? `failed: ${summary.failedCases.join(', ')}` : '',
    `turns per run: ${summary.averageTurns.toFixed(AVERAGE_DECIMALS)} on average`,
    `agent cost per run: $${summary.averageCostUsd.toFixed(COST_DECIMALS)} on average, $${summary.maxCostUsd.toFixed(COST_DECIMALS)} at most`,
    `verified facts per run: ${summary.verifiedFactsPerRun.toFixed(AVERAGE_DECIMALS)}; claims demoted to assumptions: ${summary.unverifiedClaims}; fabricated citations: ${summary.fabricatedCitations}`,
    `honest "the code does not say" on unknown questions: ${asPercent(summary.honestUnknownRate)}`,
    `total cost: $${(context.agentCostUsd + context.judgeCostUsd).toFixed(COST_DECIMALS)} (agent $${context.agentCostUsd.toFixed(COST_DECIMALS)}, judge $${context.judgeCostUsd.toFixed(COST_DECIMALS)})`,
    context.stoppedForCost ? 'STOPPED: the cost cap was reached, so the numbers are incomplete' : '',
    summary.unscorableRuns > 0 ? `${summary.unscorableRuns} run(s) could not be scored` : '',
  ]
    .filter((line) => line !== '')
    .join('\n');

const changeLine = (change: CaseChange): string =>
  `  ${change.caseId}: ${change.before === null ? 'new' : `${change.before.passes}/${change.before.runs}`} -> ${change.after.passes}/${change.after.runs}`;

const section = (title: string, lines: readonly string[]): string[] => (lines.length === 0 ? [] : [title, ...lines]);

export const renderDiff = (diff: BaselineDiff): string => {
  const lines = [
    ...section('REGRESSIONS (these fail the run):', diff.regressions.map((entry) => `${changeLine(entry)} (${entry.reason})`)),
    ...section(
      'newly failing but not a regression (flaky in the baseline):',
      diff.newlyFailing.filter((change) => !diff.regressions.some((entry) => entry.caseId === change.caseId)).map(changeLine),
    ),
    ...section('newly passing:', diff.newlyPassing.map(changeLine)),
    ...section('became flaky:', diff.becameFlaky.map(changeLine)),
    ...section('stopped being flaky:', diff.stoppedBeingFlaky.map(changeLine)),
    ...section('not in the baseline:', diff.newCases.map(changeLine)),
    ...section('in the baseline but not run:', diff.removedCases.map((caseId) => `  ${caseId}`)),
  ];
  return lines.length === 0 ? 'no change against the baseline' : lines.join('\n');
};
