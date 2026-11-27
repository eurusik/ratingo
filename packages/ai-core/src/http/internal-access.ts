import { createHash, timingSafeEqual } from 'node:crypto';

export const INTERNAL_PROXY_HEADERS: readonly string[] = [
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
  'forwarded',
  'cf-connecting-ip',
  'cf-ray',
];

export const InternalAccess = {
  ALLOWED: 'allowed',
  HIDDEN: 'hidden',
  DENIED: 'denied',
} as const;
export type InternalAccess = (typeof InternalAccess)[keyof typeof InternalAccess];

export interface InternalAccessRequest {
  expectedToken: string | undefined;
  headers: Readonly<Record<string, string | readonly string[] | undefined>>;
}

const BEARER_PREFIX = /^Bearer (\S+)$/;

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

const sameSecret = (provided: string, expected: string): boolean =>
  timingSafeEqual(digest(provided), digest(expected));

export const decideInternalAccess = ({
  expectedToken,
  headers,
}: InternalAccessRequest): InternalAccess => {
  const cameThroughPublicProxy = INTERNAL_PROXY_HEADERS.some((name) => headers[name] !== undefined);
  if (expectedToken === undefined || cameThroughPublicProxy) return InternalAccess.HIDDEN;
  const { authorization } = headers;
  const provided =
    typeof authorization === 'string' ? BEARER_PREFIX.exec(authorization)?.[1] : undefined;
  return provided !== undefined && sameSecret(provided, expectedToken)
    ? InternalAccess.ALLOWED
    : InternalAccess.DENIED;
};
