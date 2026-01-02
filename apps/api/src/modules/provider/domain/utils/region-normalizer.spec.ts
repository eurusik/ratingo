/**
 * Region Normalizer Unit Tests
 */

import {
  normalizeRegion,
  isGlobalRegion,
  isValidRegionFormat,
  GLOBAL_REGION,
} from './region-normalizer';

describe('RegionNormalizer', () => {
  describe('normalizeRegion', () => {
    it('should return global for undefined', () => {
      expect(normalizeRegion(undefined)).toBe(GLOBAL_REGION);
    });

    it('should return global for null', () => {
      expect(normalizeRegion(null)).toBe(GLOBAL_REGION);
    });

    it('should return global for empty string', () => {
      expect(normalizeRegion('')).toBe(GLOBAL_REGION);
    });

    it('should return global for whitespace-only string', () => {
      expect(normalizeRegion('   ')).toBe(GLOBAL_REGION);
    });

    it('should return global for "global" input', () => {
      expect(normalizeRegion('global')).toBe(GLOBAL_REGION);
      expect(normalizeRegion('GLOBAL')).toBe(GLOBAL_REGION);
      expect(normalizeRegion('Global')).toBe(GLOBAL_REGION);
    });

    it('should uppercase lowercase region codes', () => {
      expect(normalizeRegion('us')).toBe('US');
      expect(normalizeRegion('ua')).toBe('UA');
      expect(normalizeRegion('de')).toBe('DE');
    });

    it('should keep uppercase region codes', () => {
      expect(normalizeRegion('US')).toBe('US');
      expect(normalizeRegion('UA')).toBe('UA');
      expect(normalizeRegion('DE')).toBe('DE');
    });

    it('should handle mixed case', () => {
      expect(normalizeRegion('Us')).toBe('US');
      expect(normalizeRegion('uA')).toBe('UA');
    });

    it('should trim whitespace', () => {
      expect(normalizeRegion(' us ')).toBe('US');
      expect(normalizeRegion('  UA  ')).toBe('UA');
    });

    it('should convert UK alias to GB', () => {
      expect(normalizeRegion('uk')).toBe('GB');
      expect(normalizeRegion('UK')).toBe('GB');
      expect(normalizeRegion('Uk')).toBe('GB');
    });

    it('should convert en alias to GB', () => {
      expect(normalizeRegion('en')).toBe('GB');
      expect(normalizeRegion('EN')).toBe('GB');
    });
  });

  describe('isGlobalRegion', () => {
    it('should return true for global', () => {
      expect(isGlobalRegion(GLOBAL_REGION)).toBe(true);
      expect(isGlobalRegion('global')).toBe(true);
    });

    it('should return false for country codes', () => {
      expect(isGlobalRegion('US')).toBe(false);
      expect(isGlobalRegion('UA')).toBe(false);
      expect(isGlobalRegion('GB')).toBe(false);
    });
  });

  describe('isValidRegionFormat', () => {
    it('should return true for global', () => {
      expect(isValidRegionFormat(GLOBAL_REGION)).toBe(true);
    });

    it('should return true for valid ISO codes', () => {
      expect(isValidRegionFormat('US')).toBe(true);
      expect(isValidRegionFormat('UA')).toBe(true);
      expect(isValidRegionFormat('GB')).toBe(true);
      expect(isValidRegionFormat('DE')).toBe(true);
    });

    it('should return false for lowercase codes', () => {
      expect(isValidRegionFormat('us')).toBe(false);
      expect(isValidRegionFormat('ua')).toBe(false);
    });

    it('should return false for invalid formats', () => {
      expect(isValidRegionFormat('USA')).toBe(false);
      expect(isValidRegionFormat('U')).toBe(false);
      expect(isValidRegionFormat('')).toBe(false);
      expect(isValidRegionFormat('123')).toBe(false);
    });
  });
});
