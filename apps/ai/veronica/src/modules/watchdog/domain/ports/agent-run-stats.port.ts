import type { AgentRunStats } from '../entities/agent-run-stats';

export interface AgentRunStatsPort {
  read(agents: readonly string[], nowMs: number): Promise<AgentRunStats>;
}

export const AGENT_RUN_STATS_PORT = Symbol('AGENT_RUN_STATS_PORT');
