/**
 * Offer Mapper Utility Tests
 */

import { type MediaWatchOfferView } from '../../../provider/public';

import { mapOffersToNormalized } from './offer-mapper';

describe('mapOffersToNormalized', () => {
  it('should map empty array to empty array', () => {
    const result = mapOffersToNormalized([]);
    expect(result).toEqual([]);
  });

  it('should map single offer correctly', () => {
    const offers: MediaWatchOfferView[] = [
      {
        providerId: 'netflix',
        offerType: 'flatrate',
        distributionChannel: 'direct',
        variantIsAdsTier: false,
      },
    ];

    const result = mapOffersToNormalized(offers);

    expect(result).toEqual([
      {
        providerId: 'netflix',
        offerType: 'flatrate',
        distributionChannel: 'direct',
        isAdsTier: false,
      },
    ]);
  });

  it('should map multiple offers correctly', () => {
    const offers: MediaWatchOfferView[] = [
      {
        providerId: 'netflix',
        offerType: 'flatrate',
        distributionChannel: 'direct',
        variantIsAdsTier: false,
      },
      {
        providerId: 'amazon',
        offerType: 'rent',
        distributionChannel: 'amazon_channel',
        variantIsAdsTier: true,
      },
    ];

    const result = mapOffersToNormalized(offers);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      providerId: 'netflix',
      offerType: 'flatrate',
      distributionChannel: 'direct',
      isAdsTier: false,
    });
    expect(result[1]).toEqual({
      providerId: 'amazon',
      offerType: 'rent',
      distributionChannel: 'amazon_channel',
      isAdsTier: true,
    });
  });

  it('should handle undefined variantIsAdsTier as undefined', () => {
    const offers: MediaWatchOfferView[] = [
      {
        providerId: 'hbo',
        offerType: 'flatrate',
        distributionChannel: 'direct',
        variantIsAdsTier: undefined,
      },
    ];

    const result = mapOffersToNormalized(offers);

    expect(result[0].isAdsTier).toBeUndefined();
  });

  it('should only extract required fields for policy engine', () => {
    const offers: MediaWatchOfferView[] = [
      {
        providerId: 'disney',
        offerType: 'flatrate',
        distributionChannel: 'direct',
        variantIsAdsTier: false,
      },
    ];

    const result = mapOffersToNormalized(offers);

    // Should only have the 4 required fields
    expect(Object.keys(result[0])).toEqual([
      'providerId',
      'offerType',
      'distributionChannel',
      'isAdsTier',
    ]);
  });

  it('should handle apple_tv_channel distribution', () => {
    const offers: MediaWatchOfferView[] = [
      {
        providerId: 'paramount',
        offerType: 'flatrate',
        distributionChannel: 'apple_tv_channel',
        variantIsAdsTier: true,
      },
    ];

    const result = mapOffersToNormalized(offers);

    expect(result[0].distributionChannel).toBe('apple_tv_channel');
    expect(result[0].isAdsTier).toBe(true);
  });
});
