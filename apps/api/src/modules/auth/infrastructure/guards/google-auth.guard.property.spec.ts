import * as fc from 'fast-check';
import { RETURN_TO_PATTERN } from '../../auth.constants';

function validateReturnTo(returnTo?: string): string | null {
  if (!returnTo) return null;
  // Only allow relative paths: starts with /, no //, matches safe pattern
  if (!RETURN_TO_PATTERN.test(returnTo) || returnTo.startsWith('//')) {
    return null;
  }
  return returnTo;
}

describe('Google OAuth - returnTo Validation Property Tests', () => {
  describe('Property 1: returnTo Path Validation', () => {
    // Arbitrary for valid relative paths
    const validRelativePathArb = fc
      .tuple(fc.constant('/'), fc.stringMatching(/^[a-zA-Z0-9/_\-?=&.]*$/))
      .map(([slash, rest]) => slash + rest)
      .filter((path) => !path.startsWith('//'));

    // Arbitrary for protocol-relative URLs (should be rejected)
    const protocolRelativeUrlArb = fc
      .tuple(
        fc.constant('//'),
        fc.webUrl().map((url) => url.replace(/^https?:\/\//, '')),
      )
      .map(([prefix, rest]) => prefix + rest);

    // Arbitrary for absolute URLs with protocol (should be rejected)
    const absoluteUrlArb = fc.webUrl();

    // Arbitrary for paths not starting with / (should be rejected)
    const nonSlashStartPathArb = fc
      .stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9/_\-?=&.]*$/)
      .filter((s) => s.length > 0 && !s.startsWith('/'));

    // Arbitrary for paths with invalid characters (should be rejected)
    const invalidCharPathArb = fc
      .tuple(
        fc.constant('/'),
        fc.string({ minLength: 1 }).filter((s) => /[^a-zA-Z0-9/_\-?=&.]/.test(s)),
      )
      .map(([slash, rest]) => slash + rest);

    it('should accept valid relative paths starting with /', () => {
      fc.assert(
        fc.property(validRelativePathArb, (path) => {
          const result = validateReturnTo(path);
          // Valid relative paths should be accepted (returned as-is)
          expect(result).toBe(path);
        }),
        { numRuns: 100 },
      );
    });

    it('should reject protocol-relative URLs (starting with //)', () => {
      fc.assert(
        fc.property(protocolRelativeUrlArb, (url) => {
          const result = validateReturnTo(url);
          // Protocol-relative URLs should be rejected
          expect(result).toBeNull();
        }),
        { numRuns: 100 },
      );
    });

    it('should reject absolute URLs with protocol', () => {
      fc.assert(
        fc.property(absoluteUrlArb, (url) => {
          const result = validateReturnTo(url);
          // Absolute URLs should be rejected (don't start with /)
          expect(result).toBeNull();
        }),
        { numRuns: 100 },
      );
    });

    it('should reject paths not starting with /', () => {
      fc.assert(
        fc.property(nonSlashStartPathArb, (path) => {
          const result = validateReturnTo(path);
          // Paths not starting with / should be rejected
          expect(result).toBeNull();
        }),
        { numRuns: 100 },
      );
    });

    it('should reject paths with invalid characters', () => {
      fc.assert(
        fc.property(invalidCharPathArb, (path) => {
          const result = validateReturnTo(path);
          // Paths with invalid characters should be rejected
          expect(result).toBeNull();
        }),
        { numRuns: 100 },
      );
    });

    it('should return null for empty/undefined input', () => {
      expect(validateReturnTo(undefined)).toBeNull();
      expect(validateReturnTo('')).toBeNull();
    });

    // Comprehensive property: any string is either accepted as valid relative path or rejected
    it('should partition all strings into valid relative paths or rejected', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const result = validateReturnTo(input);

          if (result !== null) {
            // If accepted, must be a valid relative path
            expect(result).toBe(input);
            expect(result.startsWith('/')).toBe(true);
            expect(result.startsWith('//')).toBe(false);
            expect(RETURN_TO_PATTERN.test(result)).toBe(true);
          } else {
            // If rejected, must violate at least one rule:
            // - empty/undefined
            // - doesn't start with /
            // - starts with //
            // - contains invalid characters
            const isEmpty = !input;
            const doesntStartWithSlash = !input.startsWith('/');
            const startsWithDoubleSlash = input.startsWith('//');
            const hasInvalidChars = !RETURN_TO_PATTERN.test(input);

            expect(
              isEmpty || doesntStartWithSlash || startsWithDoubleSlash || hasInvalidChars,
            ).toBe(true);
          }
        }),
        { numRuns: 100 },
      );
    });
  });
});
