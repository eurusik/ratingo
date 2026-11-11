import type { Dictionary } from '@/shared/i18n';

export type OAuthErrorKey = keyof Dictionary['oauth']['errors'];

export const MISSING_CODE_ERROR = 'OAUTH_EXCHANGE_EXPIRED';

const ERROR_KEY_BY_CODE = new Map<string, OAuthErrorKey>([
  ['OAUTH_ACCOUNT_EXISTS_PASSWORD', 'accountExistsPassword'],
  ['OAUTH_CANCELLED', 'cancelled'],
  ['OAUTH_EMAIL_NOT_VERIFIED', 'emailNotVerified'],
  ['OAUTH_EXCHANGE_EXPIRED', 'exchangeExpired'],
  ['OAUTH_EXCHANGE_USED', 'exchangeUsed'],
  ['OAUTH_PROVIDER_ERROR', 'providerError'],
  ['OAUTH_STATE_INVALID', 'stateInvalid'],
]);

export function toOAuthErrorKey(code: string): OAuthErrorKey {
  return ERROR_KEY_BY_CODE.get(code) ?? 'unknown';
}
