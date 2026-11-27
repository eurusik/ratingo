export interface AgentRunReading {
  spentUsd: number;
  failedRuns: number;
  dayBudgetUsd: number | null;
}

export type AgentRunStats = ReadonlyMap<string, AgentRunReading>;
