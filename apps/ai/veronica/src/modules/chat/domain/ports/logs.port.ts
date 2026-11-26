import type { LogsFailureClass } from '../constants/logs.constants';

export interface LogQuery {
  logql: string;
  startMs: number;
  endMs: number;
  limit: number;
}

export interface RawLogLine {
  atMs: number;
  line: string;
}

export interface LogsFetch {
  lines: RawLogLine[];
  limitReached: boolean;
}

export interface LogsPort {
  search(query: LogQuery): Promise<LogsFetch>;
}

export const LOGS_PORT = Symbol('LOGS_PORT');

export class LogsUnavailableError extends Error {
  constructor(readonly reason: LogsFailureClass) {
    super(`logs_search is unavailable: ${reason}`);
    this.name = 'LogsUnavailableError';
  }
}
