import type { BackupOutcome } from './backup-outcome';

export interface DatabaseDump {
  fileName: string;
  filePath: string;
  sizeBytes: number;
}

export interface DatabaseDumper {
  dump(baseName: string): Promise<DatabaseDump>;
  discard(dump: DatabaseDump): Promise<void>;
}

export interface BackupStorage {
  upload(dump: DatabaseDump): Promise<void>;
}

export interface BackupMetrics {
  report(outcome: BackupOutcome): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface Sleeper {
  sleep(ms: number): Promise<void>;
}
