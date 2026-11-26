export const JobFailureClass = {
  RATE_LIMIT: 'rate_limit',
  ACCESS_DENIED: 'access_denied',
  NOT_FOUND: 'not_found',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  DATABASE: 'database',
  OTHER: 'other',
} as const;
export type JobFailureClass = (typeof JobFailureClass)[keyof typeof JobFailureClass];

export const JOB_FAILURE_CLASSES: readonly JobFailureClass[] = Object.values(JobFailureClass);
