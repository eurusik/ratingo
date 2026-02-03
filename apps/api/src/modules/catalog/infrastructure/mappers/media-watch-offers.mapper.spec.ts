import { MediaWatchOffersMapper, type WatchOfferRow } from './media-watch-offers.mapper';
import type { WatchProvidersMap } from '../../../ingestion/public';

describe('MediaWatchOffersMapper', () => {
  const createOffer = (overrides: Partial<WatchOfferRow> = {}): WatchOfferRow => ({
    providerId: 'netflix',
    displayName: 'Netflix',
    logoPath: '/netflix.png',
    priority: 1,
    offerType: 'flatrate',
    region: 'UA',
    link: 'https://netflix.com/watch',
    ...overrides,
  });

  describe('toAvailability', () => {
    describe('region selection', () => {
      it('should prefer UA offers over US offers', () => {
        const uaOffer = createOffer({ region: 'UA', providerId: 'sweet-tv' });
        const usOffer = createOffer({ region: 'US', providerId: 'netflix' });

        const result = MediaWatchOffersMapper.toAvailability([uaOffer, usOffer]);

        expect(result.region).toBe('UA');
        expect(result.isFallback).toBe(false);
        expect(result.stream).toHaveLength(1);
        expect(result.stream![0].id).toBe('sweet-tv');
      });

      it('should fallback to US offers when UA has no offers', () => {
        const usOffer = createOffer({ region: 'US', providerId: 'netflix' });

        const result = MediaWatchOffersMapper.toAvailability([usOffer]);

        expect(result.region).toBe('US');
        expect(result.isFallback).toBe(true);
      });

      it('should return null region when no offers exist', () => {
        const result = MediaWatchOffersMapper.toAvailability([]);

        expect(result.region).toBeNull();
        expect(result.isFallback).toBe(false);
      });

      it('should handle case-insensitive region codes', () => {
        const offer = createOffer({ region: 'ua' });

        const result = MediaWatchOffersMapper.toAvailability([offer]);

        expect(result.region).toBe('UA');
      });
    });

    describe('hint computation', () => {
      it('should return "svod" hint when stream providers exist', () => {
        const offer = createOffer({ offerType: 'flatrate' });

        const result = MediaWatchOffersMapper.toAvailability([offer]);

        expect(result.hint).toBe('svod');
      });

      it('should return "svod" hint when free providers exist', () => {
        const offer = createOffer({ offerType: 'free' });

        const result = MediaWatchOffersMapper.toAvailability([offer]);

        expect(result.hint).toBe('svod');
      });

      it('should return "tvod_only" hint when only rent/buy providers exist', () => {
        const rentOffer = createOffer({ offerType: 'rent' });
        const buyOffer = createOffer({ offerType: 'buy', providerId: 'apple' });

        const result = MediaWatchOffersMapper.toAvailability([rentOffer, buyOffer]);

        expect(result.hint).toBe('tvod_only');
        expect(result.rent).toHaveLength(1);
        expect(result.buy).toHaveLength(1);
        expect(result.stream).toBeUndefined();
      });

      it('should return "tvod_only" hint when only ads providers exist', () => {
        const adsOffer = createOffer({ offerType: 'ads' });

        const result = MediaWatchOffersMapper.toAvailability([adsOffer]);

        expect(result.hint).toBe('tvod_only');
      });

      it('should return "svod" if mixed offers include stream/free', () => {
        const streamOffer = createOffer({ offerType: 'flatrate' });
        const rentOffer = createOffer({ offerType: 'rent', providerId: 'apple' });

        const result = MediaWatchOffersMapper.toAvailability([streamOffer, rentOffer]);

        expect(result.hint).toBe('svod');
      });
    });

    describe('fallback hint from raw providers', () => {
      it('should return "tvod_only" when raw providers have rent/buy', () => {
        const rawProviders: WatchProvidersMap = {
          UA: {
            link: 'https://tmdb.org/watch/ua',
            rent: [{ providerId: 1, name: 'Apple', logoPath: '/apple.png' }],
          },
        };

        const result = MediaWatchOffersMapper.toAvailability([], rawProviders);

        expect(result.hint).toBe('tvod_only');
        expect(result.tmdbWatchUrl).toBe('https://tmdb.org/watch/ua');
      });

      it('should return "none" when no raw providers', () => {
        const result = MediaWatchOffersMapper.toAvailability([]);

        expect(result.hint).toBe('none');
        expect(result.tmdbWatchUrl).toBeNull();
      });

      it('should return "none" when raw providers have no rent/buy', () => {
        const rawProviders: WatchProvidersMap = {
          UA: {
            link: 'https://tmdb.org/watch/ua',
          },
        };

        const result = MediaWatchOffersMapper.toAvailability([], rawProviders);

        expect(result.hint).toBe('none');
      });

      it('should check US region in raw providers for fallback', () => {
        const rawProviders: WatchProvidersMap = {
          US: {
            link: 'https://tmdb.org/watch/us',
            buy: [{ providerId: 1, name: 'Apple', logoPath: '/apple.png' }],
          },
        };

        const result = MediaWatchOffersMapper.toAvailability([], rawProviders);

        expect(result.hint).toBe('tvod_only');
        expect(result.tmdbWatchUrl).toBe('https://tmdb.org/watch/us');
      });
    });

    describe('groupByOfferType', () => {
      it('should group offers by type correctly', () => {
        const offers = [
          createOffer({ offerType: 'flatrate', providerId: 'netflix' }),
          createOffer({ offerType: 'rent', providerId: 'apple-rent' }),
          createOffer({ offerType: 'buy', providerId: 'apple-buy' }),
          createOffer({ offerType: 'ads', providerId: 'peacock' }),
          createOffer({ offerType: 'free', providerId: 'tubi' }),
        ];

        const result = MediaWatchOffersMapper.toAvailability(offers);

        expect(result.stream).toHaveLength(1);
        expect(result.rent).toHaveLength(1);
        expect(result.buy).toHaveLength(1);
        expect(result.ads).toHaveLength(1);
        expect(result.free).toHaveLength(1);
      });

      it('should deduplicate same provider per offer type', () => {
        const offers = [
          createOffer({ offerType: 'flatrate', providerId: 'netflix' }),
          createOffer({ offerType: 'flatrate', providerId: 'netflix' }),
        ];

        const result = MediaWatchOffersMapper.toAvailability(offers);

        expect(result.stream).toHaveLength(1);
      });

      it('should allow same provider in different offer types', () => {
        const offers = [
          createOffer({ offerType: 'flatrate', providerId: 'apple' }),
          createOffer({ offerType: 'rent', providerId: 'apple' }),
          createOffer({ offerType: 'buy', providerId: 'apple' }),
        ];

        const result = MediaWatchOffersMapper.toAvailability(offers);

        expect(result.stream).toHaveLength(1);
        expect(result.rent).toHaveLength(1);
        expect(result.buy).toHaveLength(1);
      });

      it('should sort by priority (lower = higher priority)', () => {
        const offers = [
          createOffer({ offerType: 'flatrate', providerId: 'low-priority', priority: 100 }),
          createOffer({ offerType: 'flatrate', providerId: 'high-priority', priority: 1 }),
          createOffer({ offerType: 'flatrate', providerId: 'medium-priority', priority: 50 }),
        ];

        const result = MediaWatchOffersMapper.toAvailability(offers);

        expect(result.stream![0].id).toBe('high-priority');
        expect(result.stream![1].id).toBe('medium-priority');
        expect(result.stream![2].id).toBe('low-priority');
      });

      it('should handle null priority with default fallback', () => {
        const offers = [
          createOffer({ offerType: 'flatrate', providerId: 'with-priority', priority: 10 }),
          createOffer({ offerType: 'flatrate', providerId: 'no-priority', priority: null }),
        ];

        const result = MediaWatchOffersMapper.toAvailability(offers);

        expect(result.stream![0].id).toBe('with-priority');
        expect(result.stream![1].id).toBe('no-priority');
      });

      it('should return undefined for empty offer type arrays', () => {
        const offers = [createOffer({ offerType: 'flatrate' })];

        const result = MediaWatchOffersMapper.toAvailability(offers);

        expect(result.stream).toHaveLength(1);
        expect(result.rent).toBeUndefined();
        expect(result.buy).toBeUndefined();
        expect(result.ads).toBeUndefined();
        expect(result.free).toBeUndefined();
      });
    });

    describe('link capture', () => {
      it('should capture first available link', () => {
        const offers = [
          createOffer({ link: null, providerId: 'no-link' }),
          createOffer({ link: 'https://first.com', providerId: 'first' }),
          createOffer({ link: 'https://second.com', providerId: 'second' }),
        ];

        const result = MediaWatchOffersMapper.toAvailability(offers);

        expect(result.link).toBe('https://first.com');
      });

      it('should return null link when no offers have links', () => {
        const offers = [createOffer({ link: null })];

        const result = MediaWatchOffersMapper.toAvailability(offers);

        expect(result.link).toBeNull();
      });
    });

    describe('provider mapping', () => {
      it('should map provider with canonical string ID', () => {
        const offer = createOffer({ providerId: 'netflix' });

        const result = MediaWatchOffersMapper.toAvailability([offer]);

        expect(result.stream![0].id).toBe('netflix');
      });

      it('should include numeric hash for backward compatibility', () => {
        const offer = createOffer({ providerId: 'netflix' });

        const result = MediaWatchOffersMapper.toAvailability([offer]);

        expect(typeof result.stream![0].providerId).toBe('number');
        expect(result.stream![0].providerId).toBeGreaterThan(0);
      });

      it('should generate consistent hash for same provider ID', () => {
        const offer1 = createOffer({ providerId: 'netflix' });
        const offer2 = createOffer({ providerId: 'netflix', region: 'US' });

        const result1 = MediaWatchOffersMapper.toAvailability([offer1]);
        const result2 = MediaWatchOffersMapper.toAvailability([offer2]);

        expect(result1.stream![0].providerId).toBe(result2.stream![0].providerId);
      });

      it('should map display name correctly', () => {
        const offer = createOffer({ displayName: 'Netflix Premium' });

        const result = MediaWatchOffersMapper.toAvailability([offer]);

        expect(result.stream![0].name).toBe('Netflix Premium');
      });

      it('should map logo path to ImageData', () => {
        const offer = createOffer({ logoPath: '/logo.png' });

        const result = MediaWatchOffersMapper.toAvailability([offer]);

        expect(result.stream![0].logo).toBeDefined();
        expect(result.stream![0].logo?.original).toContain('/logo.png');
      });

      it('should handle null logo path', () => {
        const offer = createOffer({ logoPath: null });

        const result = MediaWatchOffersMapper.toAvailability([offer]);

        expect(result.stream![0].logo).toBeNull();
      });

      it('should map display priority', () => {
        const offer = createOffer({ priority: 5 });

        const result = MediaWatchOffersMapper.toAvailability([offer]);

        expect(result.stream![0].displayPriority).toBe(5);
      });

      it('should set displayPriority to undefined when null', () => {
        const offer = createOffer({ priority: null });

        const result = MediaWatchOffersMapper.toAvailability([offer]);

        expect(result.stream![0].displayPriority).toBeUndefined();
      });
    });

    describe('edge cases', () => {
      it('should handle null offers array', () => {
        const result = MediaWatchOffersMapper.toAvailability(null as unknown as WatchOfferRow[]);

        expect(result.region).toBeNull();
        expect(result.hint).toBe('none');
      });

      it('should handle undefined offers array', () => {
        const result = MediaWatchOffersMapper.toAvailability(
          undefined as unknown as WatchOfferRow[],
        );

        expect(result.region).toBeNull();
        expect(result.hint).toBe('none');
      });

      it('should handle empty offers array', () => {
        const result = MediaWatchOffersMapper.toAvailability([]);

        expect(result.region).toBeNull();
        expect(result.hint).toBe('none');
      });

      it('should ignore offers from unsupported regions', () => {
        const offer = createOffer({ region: 'GB' });

        const result = MediaWatchOffersMapper.toAvailability([offer]);

        expect(result.region).toBeNull();
        expect(result.stream).toBeUndefined();
      });
    });
  });
});
