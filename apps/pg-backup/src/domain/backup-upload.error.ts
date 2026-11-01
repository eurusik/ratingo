export class BackupUploadError extends Error {
  readonly retryable: boolean;

  constructor(message: string, options: { retryable: boolean }) {
    super(message);
    this.name = 'BackupUploadError';
    this.retryable = options.retryable;
  }
}
