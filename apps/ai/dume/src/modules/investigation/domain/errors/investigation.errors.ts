export const SnapshotFailure = {
  REF_NOT_ALLOWED: 'ref_not_allowed',
  REF_NOT_FOUND: 'ref_not_found',
  RATE_LIMITED: 'rate_limited',
  DOWNLOAD_FAILED: 'download_failed',
  ARCHIVE_TOO_LARGE: 'archive_too_large',
  ARCHIVE_INVALID: 'archive_invalid',
  NOT_CONFIGURED: 'not_configured',
} as const;
export type SnapshotFailure = (typeof SnapshotFailure)[keyof typeof SnapshotFailure];

export class SnapshotUnavailableError extends Error {
  constructor(
    readonly failure: SnapshotFailure,
    detail?: string,
  ) {
    super(detail === undefined ? `Code snapshot unavailable: ${failure}` : `Code snapshot unavailable: ${failure} (${detail})`);
    this.name = 'SnapshotUnavailableError';
  }
}
