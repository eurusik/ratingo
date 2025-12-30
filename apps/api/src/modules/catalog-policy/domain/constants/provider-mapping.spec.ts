import {
  resolveCanonicalProvider,
  CANONICAL_PROVIDERS,
  PROVIDER_ID_TO_CANONICAL,
} from './provider-mapping';

describe('Provider Mapping', () => {
  describe('resolveCanonicalProvider', () => {
    it('should resolve Netflix (providerId: 8)', () => {
      expect(resolveCanonicalProvider(8)).toBe('netflix');
    });

    it('should resolve HBO Max (providerId: 384)', () => {
      expect(resolveCanonicalProvider(384)).toBe('hbo_max');
    });

    it('should resolve Max rebrand (providerId: 1899)', () => {
      expect(resolveCanonicalProvider(1899)).toBe('hbo_max');
    });

    it('should resolve Disney+ (providerId: 337)', () => {
      expect(resolveCanonicalProvider(337)).toBe('disney_plus');
    });

    it('should resolve Prime Video (providerId: 9)', () => {
      expect(resolveCanonicalProvider(9)).toBe('prime_video');
    });

    it('should resolve Amazon Video variant (providerId: 119)', () => {
      expect(resolveCanonicalProvider(119)).toBe('prime_video');
    });

    it('should resolve Apple TV+ (providerId: 350)', () => {
      expect(resolveCanonicalProvider(350)).toBe('apple_tv_plus');
    });

    it('should resolve Crunchyroll (providerId: 283)', () => {
      expect(resolveCanonicalProvider(283)).toBe('crunchyroll');
    });

    it('should return undefined for unknown provider', () => {
      expect(resolveCanonicalProvider(999999)).toBeUndefined();
    });

    it('should return undefined for 0', () => {
      expect(resolveCanonicalProvider(0)).toBeUndefined();
    });
  });

  describe('CANONICAL_PROVIDERS', () => {
    it('should have all expected providers', () => {
      expect(CANONICAL_PROVIDERS.NETFLIX).toBe('netflix');
      expect(CANONICAL_PROVIDERS.HBO_MAX).toBe('hbo_max');
      expect(CANONICAL_PROVIDERS.PRIME_VIDEO).toBe('prime_video');
      expect(CANONICAL_PROVIDERS.DISNEY_PLUS).toBe('disney_plus');
      expect(CANONICAL_PROVIDERS.APPLE_TV_PLUS).toBe('apple_tv_plus');
      expect(CANONICAL_PROVIDERS.CRUNCHYROLL).toBe('crunchyroll');
    });
  });

  describe('PROVIDER_ID_TO_CANONICAL', () => {
    it('should map all Netflix variants', () => {
      expect(PROVIDER_ID_TO_CANONICAL[8]).toBe('netflix');
    });

    it('should map all HBO Max variants', () => {
      expect(PROVIDER_ID_TO_CANONICAL[384]).toBe('hbo_max');
      expect(PROVIDER_ID_TO_CANONICAL[1899]).toBe('hbo_max');
    });

    it('should map all Prime Video variants', () => {
      expect(PROVIDER_ID_TO_CANONICAL[9]).toBe('prime_video');
      expect(PROVIDER_ID_TO_CANONICAL[119]).toBe('prime_video');
    });
  });
});
