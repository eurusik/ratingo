/** Maximum number of episode IDs allowed in a single batch operation. */
export const MAX_BATCH_EPISODE_IDS = 200;

/**
 * Error messages for episode progress operations.
 */
export const EPISODE_PROGRESS_ERRORS = {
  NOT_FOUND: (id: string) => `Episode ${id} not found`,
  PARTIAL_NOT_FOUND: (requested: number, found: number) =>
    `Some episodes were not found (requested ${requested}, found ${found})`,
  DIFFERENT_SHOWS: 'All episodes must belong to the same show',
} as const;

/**
 * Context strings for automated unsave actions triggered by episode progress.
 */
export const UNSAVE_CONTEXT = {
  AUTO_STARTED_WATCHING: 'auto_started_watching',
} as const;
