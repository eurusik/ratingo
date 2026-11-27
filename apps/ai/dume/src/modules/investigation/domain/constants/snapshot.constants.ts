export const SnapshotLimits = {
  MAX_FILE_BYTES: 300_000,
  MAX_FILES: 20_000,
  MAX_UNPACKED_BYTES: 150_000_000,
  MAX_ARCHIVE_BYTES: 120_000_000,
  MAX_LINE_CHARS: 6_000,
  MAX_PATH_CHARS: 300,
  MAX_PATH_SEGMENTS: 24,
  MAX_SKIPPED_ENTRIES: 5_000,
  MAX_TAR_ENTRIES: 100_000,
  MAX_TAR_STREAM_BYTES: 600_000_000,
  BINARY_SNIFF_BYTES: 8_000,
} as const;

export const SkipReason = {
  BINARY: 'binary',
  TOO_LARGE: 'too_large',
  LONG_LINES: 'long_lines',
  NOT_UTF8: 'not_utf8',
  NOT_REGULAR_FILE: 'not_regular_file',
  UNSAFE_PATH: 'unsafe_path',
  LIMIT_REACHED: 'limit_reached',
} as const;
export type SkipReason = (typeof SkipReason)[keyof typeof SkipReason];

export const ALLOWED_REFS = ['main', 'development'] as const;
export const DEFAULT_REF = 'main';
export const REF_CHECK_INTERVAL_MS = 5 * 60 * 1000;
export const MAX_RETAINED_SNAPSHOTS = 3;
export const SNAPSHOT_IN_USE_MS = 10 * 60 * 1000;
export const FAILED_BUILD_MEMORY_MS = 60 * 1000;
export const LOCAL_SNAPSHOT_SHA = 'local-checkout';
export const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
