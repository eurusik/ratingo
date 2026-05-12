/**
 * Error messages for user media state operations.
 */
export const USER_MEDIA_STATE_ERRORS = {
  PROGRESS_NOT_ALLOWED: 'progress is not allowed for completed/dropped states',
  CANNOT_PAUSE_NO_STATE: 'Cannot pause: no media state found',
  CANNOT_PAUSE_INVALID_STATE: 'Cannot pause: item must be in watching or caught_up state',
  CANNOT_RESUME_NO_STATE: 'Cannot resume: no media state found',
  CANNOT_RESUME_NOT_PAUSED: 'Cannot resume: item is not paused',
  CANNOT_DROP_PARTIAL_RATING:
    'Cannot drop: clear the rating or finish watching before dropping a rated show',
} as const;
