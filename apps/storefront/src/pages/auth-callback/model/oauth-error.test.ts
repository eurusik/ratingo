import { toOAuthErrorKey } from './oauth-error';

describe('toOAuthErrorKey', () => {
  it.each([
    ['OAUTH_ACCOUNT_EXISTS_PASSWORD', 'accountExistsPassword'],
    ['OAUTH_CANCELLED', 'cancelled'],
    ['OAUTH_EMAIL_NOT_VERIFIED', 'emailNotVerified'],
    ['OAUTH_EXCHANGE_EXPIRED', 'exchangeExpired'],
    ['OAUTH_EXCHANGE_USED', 'exchangeUsed'],
    ['OAUTH_PROVIDER_ERROR', 'providerError'],
    ['OAUTH_STATE_INVALID', 'stateInvalid'],
  ])('maps %s to %s', (code, key) => {
    expect(toOAuthErrorKey(code)).toBe(key);
  });

  it.each(['UNKNOWN', '__proto__', 'constructor', ''])('maps %p to the generic message', (code) => {
    expect(toOAuthErrorKey(code)).toBe('unknown');
  });
});
