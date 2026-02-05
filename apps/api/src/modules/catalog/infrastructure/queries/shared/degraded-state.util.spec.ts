import { createDegradedResponse, createSuccessMeta } from './degraded-state.util';

describe('degraded-state.util', () => {
  describe('createDegradedResponse', () => {
    it('returns empty array', () => {
      const result = createDegradedResponse<{ id: number }>('test reason');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('returns total=0', () => {
      const result = createDegradedResponse<unknown>('test reason');

      expect(result.total).toBe(0);
    });

    it('includes degraded=true in meta', () => {
      const result = createDegradedResponse<unknown>('test reason');

      expect(result.meta).toBeDefined();
      expect(result.meta?.degraded).toBe(true);
    });

    it('includes degradedReason in meta', () => {
      const reason = 'Evaluation data is incomplete';
      const result = createDegradedResponse<unknown>(reason);

      expect(result.meta?.degradedReason).toBe(reason);
    });

    it('preserves generic type constraint', () => {
      interface TestItem {
        id: number;
        name: string;
      }

      const result = createDegradedResponse<TestItem>('type test');

      // TypeScript will ensure the array type is correct
      // At runtime, it's an empty array with additional properties
      expect(result).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.meta?.degraded).toBe(true);
    });

    it('handles empty reason string', () => {
      const result = createDegradedResponse<unknown>('');

      expect(result.meta?.degraded).toBe(true);
      expect(result.meta?.degradedReason).toBe('');
    });

    it('handles long reason strings', () => {
      const longReason = 'A'.repeat(500);
      const result = createDegradedResponse<unknown>(longReason);

      expect(result.meta?.degradedReason).toBe(longReason);
    });
  });

  describe('createSuccessMeta', () => {
    it('returns object with degraded=false', () => {
      const meta = createSuccessMeta();

      expect(meta).toEqual({ degraded: false });
    });

    it('does not include degradedReason', () => {
      const meta = createSuccessMeta();

      expect(meta.degradedReason).toBeUndefined();
    });

    it('returns fresh object on each call', () => {
      const meta1 = createSuccessMeta();
      const meta2 = createSuccessMeta();

      expect(meta1).not.toBe(meta2);
      expect(meta1).toEqual(meta2);
    });
  });
});
