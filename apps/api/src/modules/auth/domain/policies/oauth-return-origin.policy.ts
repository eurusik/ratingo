import { type AllowedOrigin, matchesAllowedOrigin } from '@/common/utils/allowed-origin.util';

export const RETURN_ORIGIN_REJECTION = {
  MALFORMED_URL: 'MALFORMED_URL',
  NOT_A_BARE_ORIGIN: 'NOT_A_BARE_ORIGIN',
  NOT_ALLOWED: 'NOT_ALLOWED',
} as const;

type ReturnOriginRejection = (typeof RETURN_ORIGIN_REJECTION)[keyof typeof RETURN_ORIGIN_REJECTION];

export type ReturnOriginDecision =
  { allowed: true; origin: string } | { allowed: false; reason: ReturnOriginRejection };

const parseUrl = (candidate: string): URL | null => {
  try {
    return new URL(candidate);
  } catch {
    return null;
  }
};

export const evaluateReturnOrigin = (
  candidate: string,
  allowList: readonly AllowedOrigin[],
): ReturnOriginDecision => {
  const url = parseUrl(candidate);
  if (!url) {
    return { allowed: false, reason: RETURN_ORIGIN_REJECTION.MALFORMED_URL };
  }
  if (url.origin !== candidate) {
    return { allowed: false, reason: RETURN_ORIGIN_REJECTION.NOT_A_BARE_ORIGIN };
  }
  if (!matchesAllowedOrigin(url.origin, allowList)) {
    return { allowed: false, reason: RETURN_ORIGIN_REJECTION.NOT_ALLOWED };
  }
  return { allowed: true, origin: url.origin };
};
