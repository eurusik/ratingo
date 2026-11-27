import fc from 'fast-check';

import { INTERNAL_PROXY_HEADERS, InternalAccess, decideInternalAccess } from './internal-access';

const TOKEN = 'a-service-token-of-24-chars!';
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe('decideInternalAccess', () => {
  it('allows the right bearer token', () => {
    expect(decideInternalAccess({ expectedToken: TOKEN, headers: bearer(TOKEN) })).toBe(
      InternalAccess.ALLOWED,
    );
  });

  it.each([
    ['no header', {}],
    ['an empty token', { authorization: 'Bearer ' }],
    ['a wrong token', bearer('wrong')],
    ['a longer token', bearer(`${TOKEN}x`)],
    ['another scheme', { authorization: `Basic ${TOKEN}` }],
    ['a list of values', { authorization: [`Bearer ${TOKEN}`] }],
  ])('denies %s', (_name, headers) => {
    expect(decideInternalAccess({ expectedToken: TOKEN, headers })).toBe(InternalAccess.DENIED);
  });

  it('hides the endpoint when no token is configured, whatever the request carries', () => {
    expect(decideInternalAccess({ expectedToken: undefined, headers: bearer(TOKEN) })).toBe(
      InternalAccess.HIDDEN,
    );
    expect(decideInternalAccess({ expectedToken: undefined, headers: {} })).toBe(
      InternalAccess.HIDDEN,
    );
  });

  it.each(INTERNAL_PROXY_HEADERS)('hides the endpoint from a request that carries %s', (header) => {
    expect(
      decideInternalAccess({
        expectedToken: TOKEN,
        headers: { ...bearer(TOKEN), [header]: '1.2.3.4' },
      }),
    ).toBe(InternalAccess.HIDDEN);
  });

  it('allows only the exact token', () => {
    fc.assert(
      fc.property(fc.string(), (other) => {
        const decision = decideInternalAccess({ expectedToken: TOKEN, headers: bearer(other) });
        return other === TOKEN || decision === InternalAccess.DENIED;
      }),
    );
  });
});
