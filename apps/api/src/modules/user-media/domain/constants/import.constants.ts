export const IMPORT_SOURCE = {
  KINOBAZA: 'kinobaza',
} as const;
export type ImportSource = (typeof IMPORT_SOURCE)[keyof typeof IMPORT_SOURCE];

export const IMPORT_LIMITS = {
  MAX_ITEMS: 10_000,
} as const;

/**
 * State priority for no-downgrade rule.
 * Higher number = higher priority; import cannot replace a higher-priority state.
 */
export const STATE_PRIORITY: Record<string, number> = {
  planned: 1,
  watching: 2,
  paused: 3,
  dropped: 4,
  completed: 5,
};

export const MEDIA_LOOKUP_PORT = Symbol('MEDIA_LOOKUP_PORT');
