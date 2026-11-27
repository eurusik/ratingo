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

class EvalRunState {
  agentCostUsd = 0;
  judgeCostUsd = 0;
  stoppedForCost = false;
  private readonly verdicts: (RunVerdict | undefined)[][];
  private readonly outcomes: (CaseOutcome | undefined)[];

  constructor(
    private readonly cases: readonly EvalCase[],
    private readonly policy: RepeatPolicy,
  ) {
    this.verdicts = cases.map(() => new Array<RunVerdict | undefined>(policy.runs).fill(undefined));
    this.outcomes = new Array<CaseOutcome | undefined>(cases.length).fill(undefined);
  }

  costReached(maxCostUsd: number): boolean {
    return this.agentCostUsd + this.judgeCostUsd >= maxCostUsd;
  }

  record({ caseIndex, runIndex }: Task, finished: FinishedRun): CaseOutcome | undefined {
    this.agentCostUsd += finished.agentCostUsd;
    this.judgeCostUsd += finished.judgeCostUsd;
    this.verdicts[caseIndex][runIndex] = finished.verdict;
    const runs = this.verdicts[caseIndex].filter((verdict): verdict is RunVerdict => !!verdict);
    if (runs.length !== this.policy.runs) return undefined;
    const testCase = this.cases[caseIndex];
    const outcome = aggregateCase(testCase.id, testCase.kind, runs, this.policy);
    this.outcomes[caseIndex] = outcome;
    return outcome;
  }

  finishedOutcomes(): CaseOutcome[] {
    return this.outcomes.filter((outcome): outcome is CaseOutcome => outcome !== undefined);
  }
}

const tasksOf = (caseCount: number, runs: number): Task[] =>
  Array.from({ length: caseCount }, (_, caseIndex) =>
    Array.from({ length: runs }, (__, runIndex) => ({ caseIndex, runIndex })),
  ).flat();

export const runEval = async (
  cases: readonly EvalCase[],
  ports: EvalPorts,
  config: EvalRunnerConfig,
): Promise<EvalRun> => {
  assertRepeatPolicy(config.repeat);
  const state = new EvalRunState(cases, config.repeat);
  await mapWithLimit(
    tasksOf(cases.length, config.repeat.runs),
    config.concurrency,
    async (task) => {
      if (state.costReached(config.maxCostUsd)) {
        state.stoppedForCost = true;
        return;
      }
      const outcome = state.record(task, await executeRun(cases[task.caseIndex], ports));
      if (outcome !== undefined) config.onCaseFinished?.(outcome);
    },
  );
  return {
    outcomes: state.finishedOutcomes(),
    agentCostUsd: state.agentCostUsd,
    judgeCostUsd: state.judgeCostUsd,
    stoppedForCost: state.stoppedForCost,
  };
};
