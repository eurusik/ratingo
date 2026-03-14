/**
 * Shared types for the import wizard components.
 */

export interface FileState {
  status: 'idle' | 'loaded' | 'error';
  fileName?: string;
  itemCount?: number;
  skippedCount?: number;
  errorMessage?: string;
}
