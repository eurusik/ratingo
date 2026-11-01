export const API_KEY_STATUS = {
  VALID: 'valid',
  DEGRADED: 'degraded',
  INVALID: 'invalid',
  UNKNOWN: 'unknown',
} as const;

export type ApiKeyStatus = (typeof API_KEY_STATUS)[keyof typeof API_KEY_STATUS];
