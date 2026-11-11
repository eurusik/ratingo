export type AllowedReturnOrigin = string | RegExp;

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

const matchesAllowedOrigin = (origin: string, allowed: AllowedReturnOrigin): boolean =>
  typeof allowed === 'string' ? allowed === origin : allowed.test(origin);

export const evaluateReturnOrigin = (
  candidate: string,
  allowList: readonly AllowedReturnOrigin[],
): ReturnOriginDecision => {
  const url = parseUrl(candidate);
  if (!url) {
    return { allowed: false, reason: RETURN_ORIGIN_REJECTION.MALFORMED_URL };
  }
  if (url.origin !== candidate) {
    return { allowed: false, reason: RETURN_ORIGIN_REJECTION.NOT_A_BARE_ORIGIN };
  }
  if (!allowList.some((allowed) => matchesAllowedOrigin(url.origin, allowed))) {
    return { allowed: false, reason: RETURN_ORIGIN_REJECTION.NOT_ALLOWED };
  }
  return { allowed: true, origin: url.origin };
};
