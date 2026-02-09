/**
 * Error messages for user media state operations.
 */
export const USER_MEDIA_STATE_ERRORS = {
  PROGRESS_NOT_ALLOWED: 'progress is not allowed for completed/dropped states',
  CANNOT_PAUSE_NO_STATE: 'Cannot pause: no media state found',
  CANNOT_PAUSE_NOT_WATCHING: 'Cannot pause: item is not currently being watched',
  CANNOT_RESUME_NO_STATE: 'Cannot resume: no media state found',
  CANNOT_RESUME_NOT_PAUSED: 'Cannot resume: item is not paused',
} as const;
