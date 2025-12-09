import { WatchProvidersMapper } from './watch-providers.mapper';
import { WatchProvidersMap } from '../../../ingestion/domain/models/normalized-media.model';

describe('WatchProvidersMapper', () => {
  const mockProviders: WatchProvidersMap = {
    UA: {
      link: 'ua-link',
      flatrate: [{ providerId: 1, name: 'Megogo', logoPath: '/megogo.png' }],
    },
    US: {
      link: 'us-link',
      flatrate: [{ providerId: 2, name: 'Netflix', logoPath: '/netflix.png' }],
    }
  };

  it('should map domain model to DTO', () => {
    const result = WatchProvidersMapper.toDto(mockProviders);
    
    expect(result).toBeDefined();
    expect(result?.UA.link).toBe('ua-link');
    expect(result?.UA.stream).toHaveLength(1);
    expect(result?.UA.stream?.[0].name).toBe('Megogo');
    expect(result?.UA.stream?.[0].logo?.small).toContain('/megogo.png');
  });

  it('should return UA as primary if available', () => {
    const primary = WatchProvidersMapper.getPrimary(mockProviders);
    
    expect(primary).toBeDefined();
    expect(primary?.link).toBe('ua-link');
    expect(primary?.stream?.[0].name).toBe('Megogo');
  });

  it('should fallback to US as primary if UA is missing or empty', () => {
    const providersNoUa: WatchProvidersMap = {
      US: {
        link: 'us-link',
        flatrate: [{ providerId: 2, name: 'Netflix', logoPath: '/netflix.png' }],
      }
    };

    const primary = WatchProvidersMapper.getPrimary(providersNoUa);
    
    expect(primary).toBeDefined();
    expect(primary?.link).toBe('us-link');
    expect(primary?.stream?.[0].name).toBe('Netflix');
  });

  it('should fallback to US if UA exists but has no providers', () => {
    const providersEmptyUa: WatchProvidersMap = {
      UA: { link: 'ua-link', flatrate: [] },
      US: {
        link: 'us-link',
        flatrate: [{ providerId: 2, name: 'Netflix', logoPath: '/netflix.png' }],
      }
    };

    const primary = WatchProvidersMapper.getPrimary(providersEmptyUa);
    
    expect(primary).toBeDefined();
    expect(primary?.link).toBe('us-link');
  });

  it('should return null if neither UA nor US has providers', () => {
    const providersEmpty: WatchProvidersMap = {
      UA: { link: 'ua-link', flatrate: [] },
      US: { link: 'us-link', flatrate: [] }
    };

    const primary = WatchProvidersMapper.getPrimary(providersEmpty);
    
    expect(primary).toBeNull();
  });
});
