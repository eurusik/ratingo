/**
 * Provider Filter Unit Tests
 */

import type { MediaWatchOfferView } from '../../../provider/public';

import {
  filterByAvailabilityMode,
  filterOutAdsTiers,
  filterDirectDistribution,
  matchesAnyProvider,
  hasRequiredProvider,
} from './provider-filter';

describe('Provider Filter Utilities', () => {
  const createOffer = (overrides: Partial<MediaWatchOfferView> = {}): MediaWatchOfferView => ({
    providerId: 'netflix',
    offerType: 'flatrate',
    distributionChannel: 'direct',
    ...overrides,
  });

  describe('filterByAvailabilityMode', () => {
    const offers: MediaWatchOfferView[] = [
      createOffer({ providerId: 'netflix', offerType: 'flatrate' }),
      createOffer({ providerId: 'prime_video', offerType: 'rent' }),
      createOffer({ providerId: 'apple_tv', offerType: 'buy' }),
      createOffer({ providerId: 'tubi', offerType: 'ads' }),
      createOffer({ providerId: 'pluto', offerType: 'free' }),
    ];

    it('should filter to flatrate only for subscription_only mode', () => {
      const result = filterByAvailabilityMode(offers, 'subscription_only');
      expect(result).toHaveLength(1);
      expect(result[0].providerId).toBe('netflix');
    });

    it('should filter to rent/buy for transactional_only mode', () => {
      const result = filterByAvailabilityMode(offers, 'transactional_only');
      expect(result).toHaveLength(2);
      expect(result.map((o) => o.providerId)).toEqual(['prime_video', 'apple_tv']);
    });

    it('should return all offers for any mode', () => {
      const result = filterByAvailabilityMode(offers, 'any');
      expect(result).toHaveLength(5);
    });

    it('should default to subscription_only when mode is undefined', () => {
      const result = filterByAvailabilityMode(offers);
      expect(result).toHaveLength(1);
      expect(result[0].offerType).toBe('flatrate');
    });
  });

  describe('filterOutAdsTiers', () => {
    it('should filter out offers with variantIsAdsTier = true', () => {
      const offers: MediaWatchOfferView[] = [
        createOffer({ providerId: 'netflix', variantIsAdsTier: false }),
        createOffer({ providerId: 'netflix_ads', variantIsAdsTier: true }),
        createOffer({ providerId: 'prime_video' }), // undefined = not ads tier
      ];

      const result = filterOutAdsTiers(offers);
      expect(result).toHaveLength(2);
      expect(result.map((o) => o.providerId)).toEqual(['netflix', 'prime_video']);
    });

    it('should keep offers without variantIsAdsTier field', () => {
      const offers: MediaWatchOfferView[] = [
        createOffer({ providerId: 'netflix' }),
        createOffer({ providerId: 'prime_video' }),
      ];

      const result = filterOutAdsTiers(offers);
      expect(result).toHaveLength(2);
    });
  });

  describe('filterDirectDistribution', () => {
    it('should filter to direct distribution only', () => {
      const offers: MediaWatchOfferView[] = [
        createOffer({ providerId: 'netflix', distributionChannel: 'direct' }),
        createOffer({ providerId: 'hbo_max', distributionChannel: 'amazon_channel' }),
        createOffer({ providerId: 'paramount', distributionChannel: 'apple_tv_channel' }),
      ];

      const result = filterDirectDistribution(offers);
      expect(result).toHaveLength(1);
      expect(result[0].providerId).toBe('netflix');
    });
  });

  describe('matchesAnyProvider', () => {
    const offers: MediaWatchOfferView[] = [
      createOffer({ providerId: 'netflix' }),
      createOffer({ providerId: 'prime_video' }),
    ];

    it('should return true if any provider matches', () => {
      expect(matchesAnyProvider(offers, ['netflix'])).toBe(true);
      expect(matchesAnyProvider(offers, ['prime_video'])).toBe(true);
      expect(matchesAnyProvider(offers, ['disney_plus', 'netflix'])).toBe(true);
    });

    it('should return false if no provider matches', () => {
      expect(matchesAnyProvider(offers, ['disney_plus'])).toBe(false);
      expect(matchesAnyProvider(offers, ['hbo_max', 'apple_tv'])).toBe(false);
    });

    it('should return false for empty offers', () => {
      expect(matchesAnyProvider([], ['netflix'])).toBe(false);
    });
  });

  describe('hasRequiredProvider', () => {
    describe('basic matching', () => {
      it('should return true when no provider requirement', () => {
        const offers: MediaWatchOfferView[] = [];
        expect(hasRequiredProvider(offers, {})).toBe(true);
        expect(hasRequiredProvider(offers, { requireAnyOfProviders: [] })).toBe(true);
      });

      it('should return false when no offers', () => {
        expect(hasRequiredProvider([], { requireAnyOfProviders: ['netflix'] })).toBe(false);
      });

      it('should match provider with default subscription_only mode', () => {
        const offers: MediaWatchOfferView[] = [
          createOffer({ providerId: 'netflix', offerType: 'flatrate' }),
        ];

        expect(hasRequiredProvider(offers, { requireAnyOfProviders: ['netflix'] })).toBe(true);
      });

      it('should not match rent offer with default subscription_only mode', () => {
        const offers: MediaWatchOfferView[] = [
          createOffer({ providerId: 'netflix', offerType: 'rent' }),
        ];

        expect(hasRequiredProvider(offers, { requireAnyOfProviders: ['netflix'] })).toBe(false);
      });
    });

    describe('availability mode filtering', () => {
      const offers: MediaWatchOfferView[] = [
        createOffer({ providerId: 'netflix', offerType: 'flatrate' }),
        createOffer({ providerId: 'prime_video', offerType: 'rent' }),
        createOffer({ providerId: 'apple_tv', offerType: 'buy' }),
      ];

      it('should match flatrate with subscription_only', () => {
        expect(
          hasRequiredProvider(offers, {
            requireAnyOfProviders: ['netflix'],
            availabilityMode: 'subscription_only',
          }),
        ).toBe(true);
      });

      it('should not match rent with subscription_only', () => {
        expect(
          hasRequiredProvider(offers, {
            requireAnyOfProviders: ['prime_video'],
            availabilityMode: 'subscription_only',
          }),
        ).toBe(false);
      });

      it('should match rent/buy with transactional_only', () => {
        expect(
          hasRequiredProvider(offers, {
            requireAnyOfProviders: ['prime_video'],
            availabilityMode: 'transactional_only',
          }),
        ).toBe(true);

        expect(
          hasRequiredProvider(offers, {
            requireAnyOfProviders: ['apple_tv'],
            availabilityMode: 'transactional_only',
          }),
        ).toBe(true);
      });

      it('should match any offer type with any mode', () => {
        expect(
          hasRequiredProvider(offers, {
            requireAnyOfProviders: ['netflix', 'prime_video', 'apple_tv'],
            availabilityMode: 'any',
          }),
        ).toBe(true);
      });
    });

    describe('ads tier filtering', () => {
      it('should exclude ads tier when excludeAdsTiers = true', () => {
        const offers: MediaWatchOfferView[] = [
          createOffer({ providerId: 'netflix', offerType: 'flatrate', variantIsAdsTier: true }),
        ];

        expect(
          hasRequiredProvider(offers, {
            requireAnyOfProviders: ['netflix'],
            excludeAdsTiers: true,
          }),
        ).toBe(false);
      });

      it('should include non-ads tier when excludeAdsTiers = true', () => {
        const offers: MediaWatchOfferView[] = [
          createOffer({ providerId: 'netflix', offerType: 'flatrate', variantIsAdsTier: false }),
        ];

        expect(
          hasRequiredProvider(offers, {
            requireAnyOfProviders: ['netflix'],
            excludeAdsTiers: true,
          }),
        ).toBe(true); // variantIsAdsTier: false means NOT ads tier, so it passes
      });

      it('should include offers without variant info when excludeAdsTiers = true', () => {
        const offers: MediaWatchOfferView[] = [
          createOffer({ providerId: 'netflix', offerType: 'flatrate' }), // no variantIsAdsTier
        ];

        expect(
          hasRequiredProvider(offers, {
            requireAnyOfProviders: ['netflix'],
            excludeAdsTiers: true,
          }),
        ).toBe(true);
      });
    });

    describe('distribution channel filtering', () => {
      it('should exclude non-direct channels when excludeChannelDistribution = true', () => {
        const offers: MediaWatchOfferView[] = [
          createOffer({
            providerId: 'hbo_max',
            offerType: 'flatrate',
            distributionChannel: 'amazon_channel',
          }),
        ];

        expect(
          hasRequiredProvider(offers, {
            requireAnyOfProviders: ['hbo_max'],
            excludeChannelDistribution: true,
          }),
        ).toBe(false);
      });

      it('should include direct channel when excludeChannelDistribution = true', () => {
        const offers: MediaWatchOfferView[] = [
          createOffer({
            providerId: 'netflix',
            offerType: 'flatrate',
            distributionChannel: 'direct',
          }),
        ];

        expect(
          hasRequiredProvider(offers, {
            requireAnyOfProviders: ['netflix'],
            excludeChannelDistribution: true,
          }),
        ).toBe(true);
      });
    });

    describe('combined filters', () => {
      it('should apply all filters in correct order', () => {
        const offers: MediaWatchOfferView[] = [
          // This should be filtered out by subscription_only (rent)
          createOffer({
            providerId: 'netflix',
            offerType: 'rent',
            distributionChannel: 'direct',
          }),
          // This should be filtered out by excludeAdsTiers
          createOffer({
            providerId: 'netflix',
            offerType: 'flatrate',
            distributionChannel: 'direct',
            variantIsAdsTier: true,
          }),
          // This should be filtered out by excludeChannelDistribution
          createOffer({
            providerId: 'netflix',
            offerType: 'flatrate',
            distributionChannel: 'amazon_channel',
          }),
          // This should pass all filters
          createOffer({
            providerId: 'prime_video',
            offerType: 'flatrate',
            distributionChannel: 'direct',
            variantIsAdsTier: false,
          }),
        ];

        // Netflix should not match (all netflix offers filtered out)
        expect(
          hasRequiredProvider(offers, {
            requireAnyOfProviders: ['netflix'],
            availabilityMode: 'subscription_only',
            excludeAdsTiers: true,
            excludeChannelDistribution: true,
          }),
        ).toBe(false);

        // Prime Video should match
        expect(
          hasRequiredProvider(offers, {
            requireAnyOfProviders: ['prime_video'],
            availabilityMode: 'subscription_only',
            excludeAdsTiers: true,
            excludeChannelDistribution: true,
          }),
        ).toBe(true);
      });
    });
  });
});
