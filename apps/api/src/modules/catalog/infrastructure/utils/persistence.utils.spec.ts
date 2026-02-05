import { pickDefined, toDateOrNull } from './persistence.utils';

describe('persistence.utils', () => {
  describe('pickDefined', () => {
    it('should return object with only defined values', () => {
      const input = {
        a: 'value',
        b: undefined,
        c: 123,
        d: undefined,
      };

      const result = pickDefined(input);

      expect(result).toEqual({ a: 'value', c: 123 });
    });

    it('should keep null values (only filter undefined)', () => {
      const input = {
        a: 'value',
        b: null,
        c: undefined,
      };

      const result = pickDefined(input);

      expect(result).toEqual({ a: 'value', b: null });
    });

    it('should keep falsy values except undefined', () => {
      const input = {
        zero: 0,
        empty: '',
        falseVal: false,
        undef: undefined,
      };

      const result = pickDefined(input);

      expect(result).toEqual({ zero: 0, empty: '', falseVal: false });
    });

    it('should return empty object when all values are undefined', () => {
      const input = {
        a: undefined,
        b: undefined,
      };

      const result = pickDefined(input);

      expect(result).toEqual({});
    });

    it('should return same object when no undefined values', () => {
      const input = {
        a: 'value',
        b: 123,
        c: null,
      };

      const result = pickDefined(input);

      expect(result).toEqual(input);
    });

    it('should handle empty object', () => {
      const result = pickDefined({});

      expect(result).toEqual({});
    });

    it('should handle nested objects (shallow filter)', () => {
      const input = {
        nested: { inner: undefined },
        top: undefined,
      };

      const result = pickDefined(input);

      // Only filters top-level undefined, nested object stays
      expect(result).toEqual({ nested: { inner: undefined } });
    });
  });

  describe('toDateOrNull', () => {
    it('should return Date object for valid Date input', () => {
      const date = new Date('2024-01-15');

      const result = toDateOrNull(date);

      expect(result).toBeInstanceOf(Date);
      expect(result).toEqual(date);
    });

    it('should convert ISO string to Date object', () => {
      const isoString = '2024-01-15T10:30:00.000Z';

      const result = toDateOrNull(isoString);

      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(isoString);
    });

    it('should convert date string to Date object', () => {
      const dateString = '2024-01-15';

      const result = toDateOrNull(dateString);

      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(0); // January
      expect(result?.getDate()).toBe(15);
    });

    it('should return null for null input', () => {
      const result = toDateOrNull(null);

      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = toDateOrNull(undefined);

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = toDateOrNull('');

      expect(result).toBeNull();
    });

    it('should handle Date object without modification', () => {
      const originalDate = new Date('2024-06-20T15:00:00Z');

      const result = toDateOrNull(originalDate);

      expect(result).toBe(originalDate); // Same reference
    });
  });
});
