import { WatchProvidersMapper } from './watch-providers.mapper';
import { WatchProvidersMap } from '../../../ingestion/domain/models/normalized-media.model';

describe('WatchProvidersMapper', () => {
  const mockProviders: WatchProvidersMap = {
    UA: {
      link: 'https://tmdb.org/movie/123/watch?locale=UA',
      flatrate: [{ providerId: 1, name: 'Megogo', logoPath: '/megogo.png' }],
    },
    US: {
      link: 'https://tmdb.org/movie/123/watch?locale=US',
      flatrate: [{ providerId: 2, name: 'Netflix', logoPath: '/netflix.png' }],
    }
  };

  describe('toAvailability', () => {
    it('should return UA with isFallback=false when UA has providers', () => {
      const result = WatchProvidersMapper.toAvailability(mockProviders);
      
      expect(result).toBeDefined();
      expect(result?.region).toBe('UA');
      expect(result?.isFallback).toBe(false);
      expect(result?.link).toContain('locale=UA');
      expect(result?.stream).toHaveLength(1);
      expect(result?.stream?.[0].name).toBe('Megogo');
      expect(result?.stream?.[0].logo?.small).toContain('/megogo.png');
    });

    it('should fallback to US with isFallback=true when UA is missing', () => {
      const providersNoUa: WatchProvidersMap = {
        US: {
          link: 'https://tmdb.org/movie/123/watch?locale=US',
          flatrate: [{ providerId: 2, name: 'Netflix', logoPath: '/netflix.png' }],
        }
      };

      const result = WatchProvidersMapper.toAvailability(providersNoUa);
      
      expect(result).toBeDefined();
      expect(result?.region).toBe('US');
      expect(result?.isFallback).toBe(true);
      expect(result?.link).toContain('locale=US');
      expect(result?.stream?.[0].name).toBe('Netflix');
    });

    it('should fallback to US when UA exists but has no providers', () => {
      const providersEmptyUa: WatchProvidersMap = {
        UA: { link: 'ua-link', flatrate: [] },
        US: {
          link: 'https://tmdb.org/movie/123/watch?locale=US',
          flatrate: [{ providerId: 2, name: 'Netflix', logoPath: '/netflix.png' }],
        }
      };

      const result = WatchProvidersMapper.toAvailability(providersEmptyUa);
      
      expect(result).toBeDefined();
      expect(result?.region).toBe('US');
      expect(result?.isFallback).toBe(true);
    });

    it('should return null if neither UA nor US has providers', () => {
      const providersEmpty: WatchProvidersMap = {
        UA: { link: 'ua-link', flatrate: [] },
        US: { link: 'us-link', flatrate: [] }
      };

      const result = WatchProvidersMapper.toAvailability(providersEmpty);
      
      expect(result).toBeNull();
    });

    it('should return null for null/undefined input', () => {
      expect(WatchProvidersMapper.toAvailability(null)).toBeNull();
      expect(WatchProvidersMapper.toAvailability(undefined)).toBeNull();
    });

    it('should map all provider types correctly', () => {
      const fullProviders: WatchProvidersMap = {
        UA: {
          link: 'ua-link',
          flatrate: [{ providerId: 1, name: 'Stream', logoPath: '/s.png' }],
          rent: [{ providerId: 2, name: 'Rent', logoPath: '/r.png' }],
          buy: [{ providerId: 3, name: 'Buy', logoPath: '/b.png' }],
          ads: [{ providerId: 4, name: 'Ads', logoPath: '/a.png' }],
          free: [{ providerId: 5, name: 'Free', logoPath: '/f.png' }],
        }
      };

      const result = WatchProvidersMapper.toAvailability(fullProviders);
      
      expect(result?.stream).toHaveLength(1);
      expect(result?.rent).toHaveLength(1);
      expect(result?.buy).toHaveLength(1);
      expect(result?.ads).toHaveLength(1);
      expect(result?.free).toHaveLength(1);
    });
  });

  describe('toDto (deprecated)', () => {
    it('should map all regions with providers', () => {
      const result = WatchProvidersMapper.toDto(mockProviders);
      expect(result).toEqual({
        UA: expect.objectContaining({
          stream: expect.arrayContaining([expect.objectContaining({ name: 'Megogo', providerId: 1 })]),
        }),
        US: expect.objectContaining({
          stream: expect.arrayContaining([expect.objectContaining({ name: 'Netflix', providerId: 2 })]),
        }),
      });
    });

    it('should return null for null input', () => {
      expect(WatchProvidersMapper.toDto(null)).toBeNull();
    });
  });

  describe('getPrimary (deprecated)', () => {
    it('should prefer UA when it has providers', () => {
      const primary = WatchProvidersMapper.getPrimary(mockProviders);
      expect(primary?.stream?.[0].name).toBe('Megogo');
    });

    it('should fallback to US when UA empty', () => {
      const providersEmptyUa: WatchProvidersMap = {
        UA: { link: 'ua', flatrate: [] },
        US: { link: 'us', flatrate: [{ providerId: 2, name: 'Netflix', logoPath: '/netflix.png' }] },
      };
      const primary = WatchProvidersMapper.getPrimary(providersEmptyUa);
      expect(primary?.stream?.[0].name).toBe('Netflix');
    });

    it('should return null when no providers', () => {
      const providersEmpty: WatchProvidersMap = {
        UA: { link: 'ua', flatrate: [] },
        US: { link: 'us', flatrate: [] },
      };
      expect(WatchProvidersMapper.getPrimary(providersEmpty)).toBeNull();
    });

    it('should return null for null input', () => {
      expect(WatchProvidersMapper.getPrimary(null)).toBeNull();
    });
  });
});
