import type { Measured } from './measured';
import type { SourceReading } from './source-reading';

export const ApiKeyState = {
  VALID: 'valid',
  DEGRADED: 'degraded',
  INVALID: 'invalid',
  UNKNOWN: 'unknown',
} as const;
export type ApiKeyState = (typeof ApiKeyState)[keyof typeof ApiKeyState];

export const BackupResult = {
  SUCCESS: 'success',
  FAILURE: 'failure',
} as const;
export type BackupResult = (typeof BackupResult)[keyof typeof BackupResult];

export interface ProductStats {
  newUsers: Measured;
  actions: Measured;
}

export interface FailedJob {
  jobName: string;
  count: number;
}

export interface QueueStats {
  queue: string;
  backlogNow: number | null;
  backlogMax24h: Measured | null;
  completed24h: Measured;
  failed24h: Measured;
  retried24h: Measured;
  failedJobs: FailedJob[];
}

export interface ApiKeyStat {
  provider: string;
  state: ApiKeyState;
}

export const HttpErrorKind = {
  AUTH: 'auth',
  RATE_LIMIT: 'rate_limit',
} as const;
export type HttpErrorKind = (typeof HttpErrorKind)[keyof typeof HttpErrorKind];

export interface HttpErrorStat {
  server: string;
  kind: HttpErrorKind;
  count: Measured;
}

export interface BackupStats {
  lastRunAgeHours: number | null;
  lastResult: BackupResult | null;
  sizeBytes: Measured | null;
}

export interface InfraStats {
  databaseUp: boolean;
  redisUp: boolean;
  redisMemoryUsedBytes: number | null;
  redisMemoryMaxBytes: number | null;
}

export interface SchedulerJobStat {
  jobName: string;
  lastSuccessAgeHours: number | null;
  lastFailureAgeHours: number | null;
}

export interface Snapshot {
  date: string;
  generatedAtMs: number;
  product: SourceReading<ProductStats>;
  queues: SourceReading<QueueStats[]>;
  apiKeys: SourceReading<ApiKeyStat[]>;
  httpErrors: SourceReading<HttpErrorStat[]>;
  backup: SourceReading<BackupStats>;
  infra: SourceReading<InfraStats>;
  scheduler: SourceReading<SchedulerJobStat[]>;
}
