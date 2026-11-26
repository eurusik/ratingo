export interface LogEntry {
  atMs: number;
  level: string;
  context: string;
  message: string;
  occurrences: number;
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  jobId?: string;
  queue?: string;
  requestId?: string;
  runId?: string;
}

export interface LogGroup {
  count: number;
  firstAtMs: number;
  lastAtMs: number;
  level: string;
  context: string;
  sample: LogEntry;
}
