import { redactSecrets } from '@ratingo/ai-core';

import type { InvestigationOutcome } from '../src/modules/investigation/domain/entities/investigation-outcome';
import { aggregateCase, assertRepeatPolicy, type CaseOutcome, type RepeatPolicy } from './aggregate';
import { mapWithLimit } from './concurrency';
import type { EvalCase } from './eval-case';
import type { JudgePort } from './judge';
import { erroredRun, judgeInputOf, scoreRun, type MeaningCheck, type RunVerdict } from './scorer';

export interface EvalPorts {
  runAgent(testCase: EvalCase): Promise<InvestigationOutcome>;
  judge: JudgePort;
}

export interface EvalRunnerConfig {
  repeat: RepeatPolicy;
  concurrency: number;
  maxCostUsd: number;
  onCaseFinished?: (outcome: CaseOutcome) => void;
}

export interface EvalRun {
  outcomes: CaseOutcome[];
  agentCostUsd: number;
  judgeCostUsd: number;
  stoppedForCost: boolean;
}

interface Task {
  caseIndex: number;
  runIndex: number;
}

const describeError = (error: unknown): string =>
  redactSecrets(error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error');

const judgeAnswer = async (testCase: EvalCase, outcome: InvestigationOutcome, judge: JudgePort): Promise<MeaningCheck> => {
  if (outcome.answer === null) return { status: 'skipped' };
  try {
    return { status: 'judged', judgement: await judge.judge(judgeInputOf(testCase, outcome)) };
  } catch (error) {
    return { status: 'unavailable', reason: describeError(error) };
  }
};

const executeRun = async (testCase: EvalCase, ports: EvalPorts): Promise<RunVerdict> => {
  let outcome: InvestigationOutcome;
  try {
    outcome = await ports.runAgent(testCase);
  } catch (error) {
    return erroredRun(describeError(error));
  }
  return scoreRun(testCase, outcome, await judgeAnswer(testCase, outcome, ports.judge));
};

const tasksOf = (caseCount: number, runs: number): Task[] =>
  Array.from({ length: caseCount }, (_, caseIndex) => Array.from({ length: runs }, (__, runIndex) => ({ caseIndex, runIndex }))).flat();

export const runEval = async (cases: readonly EvalCase[], ports: EvalPorts, config: EvalRunnerConfig): Promise<EvalRun> => {
  assertRepeatPolicy(config.repeat);
  const verdicts = cases.map(() => new Array<RunVerdict | undefined>(config.repeat.runs).fill(undefined));
  const outcomes = new Array<CaseOutcome | undefined>(cases.length).fill(undefined);
  const spent = { agent: 0, judge: 0, stopped: false };
  await mapWithLimit(tasksOf(cases.length, config.repeat.runs), config.concurrency, async ({ caseIndex, runIndex }) => {
    if (spent.agent + spent.judge >= config.maxCostUsd) {
      spent.stopped = true;
      return;
    }
    const testCase = cases[caseIndex] as EvalCase;
    const verdict = await executeRun(testCase, ports);
    spent.agent += verdict.costUsd;
    spent.judge += verdict.judgeCostUsd;
    (verdicts[caseIndex] as (RunVerdict | undefined)[])[runIndex] = verdict;
    const finished = (verdicts[caseIndex] as (RunVerdict | undefined)[]).filter((entry): entry is RunVerdict => entry !== undefined);
    if (finished.length === config.repeat.runs) {
      const outcome = aggregateCase(testCase.id, testCase.kind, finished, config.repeat);
      outcomes[caseIndex] = outcome;
      config.onCaseFinished?.(outcome);
    }
  });
  return {
    outcomes: outcomes.filter((outcome): outcome is CaseOutcome => outcome !== undefined),
    agentCostUsd: spent.agent,
    judgeCostUsd: spent.judge,
    stoppedForCost: spent.stopped,
  };
};
