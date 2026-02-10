import { COMMUNITY_RATING_MIN_THRESHOLD } from './community-rating.constants';

describe('community-rating.constants', () => {
  describe('COMMUNITY_RATING_MIN_THRESHOLD', () => {
    it('should be a positive integer', () => {
      expect(COMMUNITY_RATING_MIN_THRESHOLD).toBeGreaterThan(0);
      expect(Number.isInteger(COMMUNITY_RATING_MIN_THRESHOLD)).toBe(true);
    });
  });
});
