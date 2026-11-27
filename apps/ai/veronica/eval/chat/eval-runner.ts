import { redactSecrets } from '@ratingo/ai-core';

import { ChatOutcome } from '../../src/modules/chat/domain/constants/chat.constants';

import {
  aggregateCase,
  assertRepeatPolicy,
  type CaseOutcome,
  type RepeatPolicy,
} from './aggregate';
import { mapWithLimit } from './concurrency';
import type { EvalCase } from './eval-case';
import { judgeInputOf, type JudgePort } from './judge';
import {
  erroredRun,
  scoreRun,
  type CaseResult,
  type MeaningCheck,
  type RunVerdict,
} from './scorer';

export interface AgentRun {
  result: CaseResult;
  costUsd: number;
}

export interface EvalPorts {
  runAgent(testCase: EvalCase): Promise<AgentRun>;
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

interface FinishedRun {
  verdict: RunVerdict;
  agentCostUsd: number;
  judgeCostUsd: number;
}

const describeError = (error: unknown): string =>
  redactSecrets(error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error');

const answerWasGenerated = (result: CaseResult): boolean =>
  result.outcome !== ChatOutcome.FALLBACK && result.outcome !== ChatOutcome.FAILED;

const judgeAnswer = async (
  testCase: EvalCase,
  result: CaseResult,
  judge: JudgePort,
): Promise<{ meaning: MeaningCheck; costUsd: number }> => {
  if (!answerWasGenerated(result)) return { meaning: { status: 'skipped' }, costUsd: 0 };
  try {
    const judgement = await judge.judge(judgeInputOf(testCase, result.answer));
    return { meaning: { status: 'judged', judgement }, costUsd: judgement.costUsd };
  } catch (error) {
    return { meaning: { status: 'unavailable', reason: describeError(error) }, costUsd: 0 };
  }
};

const executeRun = async (testCase: EvalCase, ports: EvalPorts): Promise<FinishedRun> => {
  let agent: AgentRun;
  try {
    agent = await ports.runAgent(testCase);
  } catch (error) {
    return {
      verdict: erroredRun(testCase, describeError(error)),
      agentCostUsd: 0,
      judgeCostUsd: 0,
    };
  }
  const { meaning, costUsd } = await judgeAnswer(testCase, agent.result, ports.judge);
  return {
    verdict: scoreRun(testCase, agent.result, meaning),
    agentCostUsd: agent.costUsd,
    judgeCostUsd: costUsd,
  };
};

export const runEval = async (
  cases: readonly EvalCase[],
  ports: EvalPorts,
  config: EvalRunnerConfig,
): Promise<EvalRun> => {
  assertRepeatPolicy(config.repeat);
  const tasks: Task[] = cases.flatMap((_, caseIndex) =>
    Array.from({ length: config.repeat.runs }, (__, runIndex) => ({ caseIndex, runIndex })),
  );
  const verdicts: (RunVerdict | undefined)[][] = cases.map(() =>
    new Array<RunVerdict | undefined>(config.repeat.runs).fill(undefined),
  );
  const outcomes = new Array<CaseOutcome | undefined>(cases.length).fill(undefined);
  let agentCostUsd = 0;
  let judgeCostUsd = 0;
  let stoppedForCost = false;

  const finishCase = (caseIndex: number): void => {
    const finished = verdicts[caseIndex].filter((verdict): verdict is RunVerdict => !!verdict);
    if (finished.length !== config.repeat.runs) return;
    const testCase = cases[caseIndex];
    const outcome = aggregateCase(testCase.id, testCase.kind, finished, config.repeat);
    outcomes[caseIndex] = outcome;
    config.onCaseFinished?.(outcome);
  };

  await mapWithLimit(tasks, config.concurrency, async ({ caseIndex, runIndex }) => {
    if (agentCostUsd + judgeCostUsd >= config.maxCostUsd) {
      stoppedForCost = true;
      return;
    }
    const finished = await executeRun(cases[caseIndex], ports);
    agentCostUsd += finished.agentCostUsd;
    judgeCostUsd += finished.judgeCostUsd;
    verdicts[caseIndex][runIndex] = finished.verdict;
    finishCase(caseIndex);
  });

  return {
    outcomes: outcomes.filter((outcome): outcome is CaseOutcome => outcome !== undefined),
    agentCostUsd,
    judgeCostUsd,
    stoppedForCost,
  };
};
