import type { LogsFailureClass } from './logs.constants';

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

export class LogsUnavailableError extends Error {
  constructor(readonly reason: LogsFailureClass) {
    super(`logs_search is unavailable: ${reason}`);
    this.name = 'LogsUnavailableError';
  }
}
