export const BACKUP_RESULT = {
  SUCCESS: 'success',
  FAILURE: 'failure',
} as const;

export type BackupResult = (typeof BACKUP_RESULT)[keyof typeof BACKUP_RESULT];

export interface BackupOutcome {
  result: BackupResult;
  finishedAt: Date;
  objectKey?: string;
  sizeBytes?: number;
  uploadAttempts?: number;
  errorMessage?: string;
}
