import type { ModelRequest } from '../model/model.types';

export const BudgetLevel = {
  CALL: 'call',
  RUN: 'run',
  TASK: 'task',
  AGENT_DAY: 'agent_day',
} as const;
export type BudgetLevel = (typeof BudgetLevel)[keyof typeof BudgetLevel];

export interface BudgetLimits {
  perCallUsd?: number;
  perRunUsd?: number;
  perTaskUsd?: number;
  perDayUsd?: number;
}

export interface PriorSpend {
  taskUsd: number;
  agentDayUsd: number;
}

export interface BudgetLevelState {
  level: BudgetLevel;
  limitUsd: number;
  spentUsd: number;
}

export type BudgetDecision =
  | { allowed: true }
  | { allowed: false; level: BudgetLevel; remainingUsd: number; worstCaseUsd: number };

const ESTIMATED_CHARS_PER_TOKEN = 2;

export function estimateInputTokens(
  request: Pick<ModelRequest, 'system' | 'messages' | 'tools' | 'responseSchema'>,
): number {
  const serialized = JSON.stringify([
    request.system,
    request.messages,
    request.tools,
    request.responseSchema,
  ]);
  return Math.ceil(serialized.length / ESTIMATED_CHARS_PER_TOKEN);
}

export function buildBudgetLevels(
  limits: BudgetLimits,
  priorSpend: PriorSpend,
  runSpentUsd: number,
): BudgetLevelState[] {
  const candidates: [BudgetLevel, number | undefined, number][] = [
    [BudgetLevel.CALL, limits.perCallUsd, 0],
    [BudgetLevel.RUN, limits.perRunUsd, runSpentUsd],
    [BudgetLevel.TASK, limits.perTaskUsd, priorSpend.taskUsd + runSpentUsd],
    [BudgetLevel.AGENT_DAY, limits.perDayUsd, priorSpend.agentDayUsd + runSpentUsd],
  ];
  return candidates.flatMap(([level, limitUsd, spentUsd]) =>
    limitUsd === undefined ? [] : [{ level, limitUsd, spentUsd }],
  );
}

function remainingUsd(state: BudgetLevelState): number {
  return state.limitUsd - state.spentUsd;
}

function strictestLevel(levels: readonly BudgetLevelState[]): BudgetLevelState | undefined {
  return levels.reduce<BudgetLevelState | undefined>(
    (strictest, state) =>
      strictest === undefined || remainingUsd(state) < remainingUsd(strictest) ? state : strictest,
    undefined,
  );
}

export function evaluateBudget(
  levels: readonly BudgetLevelState[],
  worstCaseUsd: number,
): BudgetDecision {
  const strictest = strictestLevel(levels);
  if (strictest === undefined || worstCaseUsd <= remainingUsd(strictest)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    level: strictest.level,
    remainingUsd: remainingUsd(strictest),
    worstCaseUsd,
  };
}
