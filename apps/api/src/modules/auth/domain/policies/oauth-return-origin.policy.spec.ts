import * as fc from 'fast-check';

import { evaluateReturnOrigin, RETURN_ORIGIN_REJECTION } from './oauth-return-origin.policy';

const PREVIEW = /^https:\/\/ratingo-storefront-[a-z0-9]{9}-eurusik\.vercel\.app$/;
const ALLOW_LIST = ['https://ratingo.top', 'https://dev.ratingo.top', PREVIEW];

const hostLabel = fc.stringMatching(/^[a-z][a-z0-9]{0,15}$/);
const bareOrigin = fc
  .tuple(fc.constantFrom('http', 'https'), hostLabel, fc.constantFrom('test', 'top', 'app'))
  .map(([scheme, host, tld]) => `${scheme}://${host}.${tld}`);

describe('evaluateReturnOrigin', () => {
  it('accepts an explicitly allowed origin', () => {
    expect(evaluateReturnOrigin('https://dev.ratingo.top', ALLOW_LIST)).toEqual({
      allowed: true,
      origin: 'https://dev.ratingo.top',
    });
  });

  it('accepts an origin that matches an allowed pattern', () => {
    expect(
      evaluateReturnOrigin('https://ratingo-storefront-abc123xyz-eurusik.vercel.app', ALLOW_LIST),
    ).toEqual({ allowed: true, origin: 'https://ratingo-storefront-abc123xyz-eurusik.vercel.app' });
  });

  it.each(['not a url', '', '//ratingo.top', 'ratingo.top', 'null'])(
    'rejects malformed value %p',
    (candidate) => {
      expect(evaluateReturnOrigin(candidate, ALLOW_LIST)).toEqual({
        allowed: false,
        reason: RETURN_ORIGIN_REJECTION.MALFORMED_URL,
      });
    },
  );

  it.each([
    'https://ratingo.top/',
    'https://ratingo.top/settings',
    'https://ratingo.top?x=1',
    'https://ratingo.top#x',
    'https://user@ratingo.top',
    'https://RATINGO.top',
    'https://ratingo.top:443',
    'javascript:alert(1)',
  ])('rejects %p because it is not a bare origin', (candidate) => {
    expect(evaluateReturnOrigin(candidate, ALLOW_LIST)).toEqual({
      allowed: false,
      reason: RETURN_ORIGIN_REJECTION.NOT_A_BARE_ORIGIN,
    });
  });

  it.each([
    'https://evil.test',
    'http://ratingo.top',
    'https://ratingo.top.evil.test',
    'https://ratingo-storefront-git-main-eurusik.vercel.app',
  ])('rejects origin %p that is not on the allow-list', (candidate) => {
    expect(evaluateReturnOrigin(candidate, ALLOW_LIST)).toEqual({
      allowed: false,
      reason: RETURN_ORIGIN_REJECTION.NOT_ALLOWED,
    });
  });

  it('accepts every bare origin that is on the allow-list', () => {
    fc.assert(
      fc.property(bareOrigin, (origin) => {
        expect(evaluateReturnOrigin(origin, [origin])).toEqual({ allowed: true, origin });
      }),
    );
  });

  it('never allows anything with an empty allow-list', () => {
    fc.assert(
      fc.property(fc.oneof(bareOrigin, fc.string()), (candidate) => {
        expect(evaluateReturnOrigin(candidate, []).allowed).toBe(false);
      }),
    );
  });

  it('rejects any allowed origin once a path is appended', () => {
    fc.assert(
      fc.property(bareOrigin, fc.webPath({ size: 'small' }), (origin, path) => {
        fc.pre(path.length > 0);
        expect(evaluateReturnOrigin(`${origin}${path}`, [origin]).allowed).toBe(false);
      }),
    );
  });

  it('returns only origins that are on the allow-list', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constantFrom(...ALLOW_LIST.map(String)), fc.string()),
        (candidate) => {
          const decision = evaluateReturnOrigin(candidate, ALLOW_LIST);
          return (
            !decision.allowed ||
            ALLOW_LIST.some((allowed) =>
              typeof allowed === 'string'
                ? allowed === decision.origin
                : allowed.test(decision.origin),
            )
          );
        },
      ),
    );
  });
});
