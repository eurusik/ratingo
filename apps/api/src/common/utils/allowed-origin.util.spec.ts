import * as fc from 'fast-check';

import { matchesAllowedOrigin } from './allowed-origin.util';

describe('matchesAllowedOrigin', () => {
  it('matches explicit origins exactly', () => {
    expect(matchesAllowedOrigin('https://a.test', ['https://a.test'])).toBe(true);
    expect(matchesAllowedOrigin('https://a.test/', ['https://a.test'])).toBe(false);
  });

  it('matches origins against patterns', () => {
    expect(matchesAllowedOrigin('https://x1.test', [/^https:\/\/x\d\.test$/])).toBe(true);
    expect(matchesAllowedOrigin('https://xx.test', [/^https:\/\/x\d\.test$/])).toBe(false);
  });

  it('never matches with an empty allow-list', () => {
    fc.assert(fc.property(fc.string(), (origin) => !matchesAllowedOrigin(origin, [])));
  });
});
