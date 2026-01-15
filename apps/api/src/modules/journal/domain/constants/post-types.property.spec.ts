import * as fc from 'fast-check';
import { POST_TYPE_VALUES, isValidPostType, PostType } from './post-types';

describe('PostTypes - Property Tests', () => {
  describe('Property 10: Valid post types only', () => {
    const validPostTypeArb = fc.constantFrom(...POST_TYPE_VALUES);

    const invalidPostTypeArb = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => !POST_TYPE_VALUES.includes(s as PostType));

    it('should accept all valid post types', () => {
      fc.assert(
        fc.property(validPostTypeArb, (type) => {
          expect(isValidPostType(type)).toBe(true);
          expect(POST_TYPE_VALUES).toContain(type);
        }),
        { numRuns: 100 },
      );
    });

    it('should reject all invalid strings as post types', () => {
      fc.assert(
        fc.property(invalidPostTypeArb, (invalidType) => {
          expect(isValidPostType(invalidType)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('should reject non-string values as post types', () => {
      const nonStringArb = fc.oneof(
        fc.integer(),
        fc.boolean(),
        fc.constant(null),
        fc.constant(undefined),
        fc.array(fc.string()),
        fc.object(),
      );

      fc.assert(
        fc.property(nonStringArb, (value) => {
          expect(isValidPostType(value)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('should have exactly 4 valid post types', () => {
      expect(POST_TYPE_VALUES).toHaveLength(4);
      expect(POST_TYPE_VALUES).toEqual(['update', 'explanation', 'fix', 'roadmap']);
    });
  });
});
