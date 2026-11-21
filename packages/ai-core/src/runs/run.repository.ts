import type { RunSnapshot } from './run';

export interface SpendQuery {
  agent: string;
  task?: string;
  sinceMs: number;
}

export interface RunRepository {
  save(run: RunSnapshot): Promise<void>;
  findRunning(agent: string): Promise<RunSnapshot[]>;
  spentUsd(query: SpendQuery): Promise<number>;
}

export const RUN_REPOSITORY = Symbol('RUN_REPOSITORY');
