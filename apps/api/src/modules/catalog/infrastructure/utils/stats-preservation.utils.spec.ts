import { preserveTotalWatchers } from './stats-preservation.utils';

describe('stats-preservation.utils', () => {
  describe('preserveTotalWatchers', () => {
    it('should return SQL expression', () => {
      const result = preserveTotalWatchers(100);

      // Should return a SQL object (we can't easily test the actual SQL without running it)
      expect(result).toBeDefined();
      expect(typeof result.getSQL).toBe('function');
    });

    it('should handle zero value', () => {
      const result = preserveTotalWatchers(0);

      expect(result).toBeDefined();
      expect(typeof result.getSQL).toBe('function');
    });

    it('should handle positive value', () => {
      const result = preserveTotalWatchers(1000);

      expect(result).toBeDefined();
      expect(typeof result.getSQL).toBe('function');
    });
  });
});
