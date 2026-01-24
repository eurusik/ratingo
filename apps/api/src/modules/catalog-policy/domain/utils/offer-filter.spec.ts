import {
  OfferType,
  DistributionChannel,
  AvailabilityMode,
  type NormalizedOffer,
  type BreakoutRule,
} from '../types/policy.types';
import {
  filterByAvailabilityMode,
  filterOffersByRequirements,
  hasAnyProvider,
} from './offer-filter';

describe('OfferFilter', () => {
  const createOffer = (overrides: Partial<NormalizedOffer> = {}): NormalizedOffer => ({
    providerId: 'netflix',
    offerType: OfferType.FLATRATE,
    distributionChannel: DistributionChannel.DIRECT,
    isAdsTier: false,
    ...overrides,
  });

  describe('filterByAvailabilityMode', () => {
    const flatrateOffer = createOffer({ offerType: OfferType.FLATRATE });
    const rentOffer = createOffer({ offerType: OfferType.RENT });
    const buyOffer = createOffer({ offerType: OfferType.BUY });
    const adsOffer = createOffer({ offerType: OfferType.ADS });
    const freeOffer = createOffer({ offerType: OfferType.FREE });

    it('should return all offers for ANY mode', () => {
      const offers = [flatrateOffer, rentOffer, buyOffer, adsOffer, freeOffer];
      const result = filterByAvailabilityMode(offers, AvailabilityMode.ANY);
      expect(result).toHaveLength(5);
    });

    it('should return only flatrate offers for SUBSCRIPTION_ONLY mode', () => {
      const offers = [flatrateOffer, rentOffer, buyOffer];
      const result = filterByAvailabilityMode(offers, AvailabilityMode.SUBSCRIPTION_ONLY);
      expect(result).toHaveLength(1);
      expect(result[0].offerType).toBe(OfferType.FLATRATE);
    });

    it('should return rent and buy offers for TRANSACTIONAL_ONLY mode', () => {
      const offers = [flatrateOffer, rentOffer, buyOffer, adsOffer];
      const result = filterByAvailabilityMode(offers, AvailabilityMode.TRANSACTIONAL_ONLY);
      expect(result).toHaveLength(2);
      expect(result.map((o) => o.offerType)).toEqual([OfferType.RENT, OfferType.BUY]);
    });

    it('should return empty array when no offers match mode', () => {
      const offers = [flatrateOffer];
      const result = filterByAvailabilityMode(offers, AvailabilityMode.TRANSACTIONAL_ONLY);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty input', () => {
      const result = filterByAvailabilityMode([], AvailabilityMode.ANY);
      expect(result).toHaveLength(0);
    });
  });

  describe('filterOffersByRequirements', () => {
    it('should filter by subscription only by default', () => {
      const offers = [
        createOffer({ offerType: OfferType.FLATRATE }),
        createOffer({ offerType: OfferType.RENT }),
      ];
      const requirements: BreakoutRule['requirements'] = {};

      const result = filterOffersByRequirements(offers, requirements);

      expect(result).toHaveLength(1);
      expect(result[0].offerType).toBe(OfferType.FLATRATE);
    });

    it('should respect custom availability mode', () => {
      const offers = [
        createOffer({ offerType: OfferType.FLATRATE }),
        createOffer({ offerType: OfferType.RENT }),
      ];
      const requirements: BreakoutRule['requirements'] = {
        availabilityMode: AvailabilityMode.ANY,
      };

      const result = filterOffersByRequirements(offers, requirements);

      expect(result).toHaveLength(2);
    });

    it('should exclude ads tiers when required', () => {
      const offers = [
        createOffer({ offerType: OfferType.FLATRATE, isAdsTier: false }),
        createOffer({ offerType: OfferType.FLATRATE, isAdsTier: true }),
      ];
      const requirements: BreakoutRule['requirements'] = {
        excludeAdsTiers: true,
      };

      const result = filterOffersByRequirements(offers, requirements);

      expect(result).toHaveLength(1);
      expect(result[0].isAdsTier).toBe(false);
    });

    it('should exclude channel distribution when required', () => {
      const offers = [
        createOffer({ distributionChannel: DistributionChannel.DIRECT }),
        createOffer({ distributionChannel: DistributionChannel.AMAZON_CHANNEL }),
        createOffer({ distributionChannel: DistributionChannel.APPLE_TV_CHANNEL }),
      ];
      const requirements: BreakoutRule['requirements'] = {
        excludeChannelDistribution: true,
        availabilityMode: AvailabilityMode.ANY,
      };

      const result = filterOffersByRequirements(offers, requirements);

      expect(result).toHaveLength(1);
      expect(result[0].distributionChannel).toBe(DistributionChannel.DIRECT);
    });

    it('should apply multiple filters together', () => {
      const offers = [
        createOffer({
          offerType: OfferType.FLATRATE,
          isAdsTier: false,
          distributionChannel: DistributionChannel.DIRECT,
        }),
        createOffer({
          offerType: OfferType.FLATRATE,
          isAdsTier: true,
          distributionChannel: DistributionChannel.DIRECT,
        }),
        createOffer({
          offerType: OfferType.FLATRATE,
          isAdsTier: false,
          distributionChannel: DistributionChannel.AMAZON_CHANNEL,
        }),
        createOffer({ offerType: OfferType.RENT }),
      ];
      const requirements: BreakoutRule['requirements'] = {
        excludeAdsTiers: true,
        excludeChannelDistribution: true,
      };

      const result = filterOffersByRequirements(offers, requirements);

      expect(result).toHaveLength(1);
      expect(result[0].isAdsTier).toBe(false);
      expect(result[0].distributionChannel).toBe(DistributionChannel.DIRECT);
    });
  });

  describe('hasAnyProvider', () => {
    it('should return false for empty offers', () => {
      expect(hasAnyProvider([], ['netflix'], {})).toBe(false);
    });

    it('should return true when provider is present', () => {
      const offers = [createOffer({ providerId: 'netflix' })];
      expect(hasAnyProvider(offers, ['netflix'], {})).toBe(true);
    });

    it('should return true when any of required providers is present', () => {
      const offers = [createOffer({ providerId: 'disney_plus' })];
      expect(hasAnyProvider(offers, ['netflix', 'disney_plus', 'hbo'], {})).toBe(true);
    });

    it('should return false when no required provider is present', () => {
      const offers = [createOffer({ providerId: 'amazon_prime' })];
      expect(hasAnyProvider(offers, ['netflix', 'disney_plus'], {})).toBe(false);
    });

    it('should apply requirements filters before checking providers', () => {
      const offers = [
        createOffer({ providerId: 'netflix', offerType: OfferType.RENT }),
        createOffer({ providerId: 'hbo', offerType: OfferType.FLATRATE }),
      ];
      const requirements: BreakoutRule['requirements'] = {
        availabilityMode: AvailabilityMode.SUBSCRIPTION_ONLY,
      };

      // Netflix has rent offer (filtered out), HBO has flatrate
      expect(hasAnyProvider(offers, ['netflix'], requirements)).toBe(false);
      expect(hasAnyProvider(offers, ['hbo'], requirements)).toBe(true);
    });

    it('should filter ads tiers before checking providers', () => {
      const offers = [
        createOffer({ providerId: 'netflix', isAdsTier: true }),
        createOffer({ providerId: 'hbo', isAdsTier: false }),
      ];
      const requirements: BreakoutRule['requirements'] = {
        excludeAdsTiers: true,
      };

      expect(hasAnyProvider(offers, ['netflix'], requirements)).toBe(false);
      expect(hasAnyProvider(offers, ['hbo'], requirements)).toBe(true);
    });
  });
});
