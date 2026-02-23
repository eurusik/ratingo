import * as fc from 'fast-check';
import { OAUTH_PROVIDER, isOAuthProvider, type OAuthProvider } from './oauth-provider';

describe('OAuthProvider', () => {
  const validProviders = Object.values(OAUTH_PROVIDER);

  describe('OAUTH_PROVIDER', () => {
    it('should contain expected providers', () => {
      expect(OAUTH_PROVIDER.GOOGLE).toBe('google');
      expect(OAUTH_PROVIDER.FACEBOOK).toBe('facebook');
    });

    it('should be a frozen-like const object', () => {
      expect(Object.keys(OAUTH_PROVIDER)).toHaveLength(2);
    });
  });

  describe('isOAuthProvider', () => {
    it.each(validProviders)('should accept valid provider "%s"', (provider) => {
      expect(isOAuthProvider(provider)).toBe(true);
    });

    it('should reject empty string', () => {
      expect(isOAuthProvider('')).toBe(false);
    });

    it.each(['Google', 'GOOGLE', 'Facebook', 'FACEBOOK'])(
      'should reject case-mismatched provider "%s"',
      (value) => {
        expect(isOAuthProvider(value)).toBe(false);
      },
    );

    it.each(['apple', 'github', 'twitter', 'linkedin', 'microsoft'])(
      'should reject unsupported provider "%s"',
      (value) => {
        expect(isOAuthProvider(value)).toBe(false);
      },
    );

    // Property: all valid providers are accepted
    it('should accept every value from OAUTH_PROVIDER', () => {
      fc.assert(
        fc.property(fc.constantFrom(...validProviders), (provider) => {
          expect(isOAuthProvider(provider)).toBe(true);
        }),
      );
    });

    // Property: arbitrary strings that aren't valid providers are rejected
    it('should reject arbitrary strings not in OAUTH_PROVIDER', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !validProviders.includes(s as OAuthProvider)),
          (value) => {
            expect(isOAuthProvider(value)).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });

    // Property: result partitions all strings
    it('should partition all strings into valid or invalid', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result = isOAuthProvider(input);
          if (result) {
            expect(validProviders).toContain(input);
          } else {
            expect(validProviders).not.toContain(input);
          }
        }),
        { numRuns: 200 },
      );
    });
  });
});
