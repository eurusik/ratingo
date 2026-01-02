/**
 * Provider Mapping Service Property-Based Tests
 *
 * Feature: provider-system-redesign
 * Tasks: 3.3, 3.4
 */

import * as fc from 'fast-check';

import { PROVIDER_MAPPING_REPOSITORY } from '../../domain/repositories/provider-mapping.repository.interface';
import type { ProviderMapping, ResolvedMapping } from '../../domain/types/provider.types';
import { GLOBAL_REGION } from '../../domain/utils/region-normalizer';
import { ProviderMappingService } from './provider-mapping.service';

describe('Provider Mapping Service - Property-Based Tests', () => {
  // Arbitraries for property-based testing

  const tmdbProviderIdArb = fc.integer({ min: 1, max: 100000 });
  const providerIdArb = fc.stringMatching(/^[a-z][a-z0-9_]{2,19}$/);
  const variantIdArb = fc.option(fc.stringMatching(/^[a-z][a-z0-9_]{2,29}$/), { nil: null });
  const distributionChannelArb = fc.constantFrom(
    'direct',
    'amazon_channel',
    'apple_tv_channel',
  ) as fc.Arbitrary<'direct' | 'amazon_channel' | 'apple_tv_channel'>;
  const regionArb = fc.stringMatching(/^[A-Z]{2}$/);
  const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') });

  const mappingArb: fc.Arbitrary<ProviderMapping> = fc.record({
    id: fc.uuid(),
    tmdbProviderId: tmdbProviderIdArb,
    providerId: providerIdArb,
    variantId: variantIdArb,
    distributionChannel: distributionChannelArb,
    region: fc.oneof(fc.constant(GLOBAL_REGION), regionArb),
    notes: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
    source: fc.constantFrom('manual', 'inferred') as fc.Arbitrary<'manual' | 'inferred'>,
    createdAt: dateArb,
  });

  /**
   * Property 3: Mapping Resolution Excludes Offer Type (Task 3.3)
   *
   * For any TMDB provider ID with a valid mapping, the resolved mapping SHALL contain
   * providerId, variantId, and distributionChannel fields, and SHALL NOT contain an
   * offerType field.
   *
   * Validates: Requirements 3.2, 3.3
   */
  describe('Property 3: Mapping Resolution Excludes Offer Type', () => {
    it('should return ResolvedMapping without offerType field', async () => {
      await fc.assert(
        fc.asyncProperty(mappingArb, async (mapping) => {
          // Arrange
          const mockRepository = createMockRepository([mapping]);
          const service = new ProviderMappingService(mockRepository);

          // Act
          const result = await service.resolve(mapping.tmdbProviderId, mapping.region);

          // Assert - result should exist
          expect(result).not.toBeNull();

          if (result) {
            // Assert - should have required fields
            expect(result).toHaveProperty('providerId');
            expect(result).toHaveProperty('variantId');
            expect(result).toHaveProperty('distributionChannel');

            // Assert - should NOT have offerType
            expect(result).not.toHaveProperty('offerType');

            // Assert - values should match mapping
            expect(result.providerId).toBe(mapping.providerId);
            expect(result.variantId).toBe(mapping.variantId);
            expect(result.distributionChannel).toBe(mapping.distributionChannel);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should return only providerId, variantId, distributionChannel in ResolvedMapping', async () => {
      await fc.assert(
        fc.asyncProperty(mappingArb, async (mapping) => {
          // Arrange
          const mockRepository = createMockRepository([mapping]);
          const service = new ProviderMappingService(mockRepository);

          // Act
          const result = await service.resolve(mapping.tmdbProviderId, mapping.region);

          // Assert
          if (result) {
            const keys = Object.keys(result).sort();
            expect(keys).toEqual(['distributionChannel', 'providerId', 'variantId']);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve offerType independence across batch resolution', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(mappingArb, { minLength: 1, maxLength: 20 }),
          async (mappings) => {
            // Arrange - deduplicate by tmdbProviderId+region
            const uniqueMappings = deduplicateByTmdbAndRegion(mappings);
            const mockRepository = createMockRepository(uniqueMappings);
            const service = new ProviderMappingService(mockRepository);

            const tmdbIds = uniqueMappings.map((m) => m.tmdbProviderId);
            const region = uniqueMappings[0]?.region ?? GLOBAL_REGION;

            // Act
            const results = await service.resolveMany(tmdbIds, region);

            // Assert - no result should have offerType
            for (const [, resolved] of results) {
              expect(resolved).not.toHaveProperty('offerType');
              expect(Object.keys(resolved).sort()).toEqual([
                'distributionChannel',
                'providerId',
                'variantId',
              ]);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 4: Region-Specific Mapping Priority (Task 3.4)
   *
   * For any TMDB provider ID that has both a global mapping (region = 'global') and
   * a region-specific mapping, resolving with that specific region SHALL return the
   * region-specific mapping, not the global one.
   *
   * Validates: Requirements 3.5, 3.6
   */
  describe('Property 4: Region-Specific Mapping Priority', () => {
    it('should prefer region-specific mapping over global', async () => {
      await fc.assert(
        fc.asyncProperty(
          tmdbProviderIdArb,
          providerIdArb,
          providerIdArb,
          regionArb,
          async (tmdbId, globalProviderId, regionProviderId, region) => {
            // Skip if providers are the same (can't distinguish)
            fc.pre(globalProviderId !== regionProviderId);

            // Arrange - create global and region-specific mappings
            const globalMapping = createMapping(tmdbId, globalProviderId, GLOBAL_REGION);
            const regionMapping = createMapping(tmdbId, regionProviderId, region);

            const mockRepository = createMockRepositoryWithFallback([globalMapping, regionMapping]);
            const service = new ProviderMappingService(mockRepository);

            // Act - resolve with specific region
            const result = await service.resolve(tmdbId, region);

            // Assert - should return region-specific, not global
            expect(result).not.toBeNull();
            expect(result?.providerId).toBe(regionProviderId);
            expect(result?.providerId).not.toBe(globalProviderId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should fall back to global when region-specific not found', async () => {
      await fc.assert(
        fc.asyncProperty(
          tmdbProviderIdArb,
          providerIdArb,
          regionArb,
          regionArb,
          async (tmdbId, globalProviderId, mappedRegion, queryRegion) => {
            // Skip if regions are the same
            fc.pre(mappedRegion !== queryRegion);

            // Arrange - only global mapping exists
            const globalMapping = createMapping(tmdbId, globalProviderId, GLOBAL_REGION);

            const mockRepository = createMockRepositoryWithFallback([globalMapping]);
            const service = new ProviderMappingService(mockRepository);

            // Act - resolve with different region
            const result = await service.resolve(tmdbId, queryRegion);

            // Assert - should fall back to global
            expect(result).not.toBeNull();
            expect(result?.providerId).toBe(globalProviderId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return null when no mapping exists (neither region nor global)', async () => {
      await fc.assert(
        fc.asyncProperty(tmdbProviderIdArb, regionArb, async (tmdbId, region) => {
          // Arrange - no mappings
          const mockRepository = createMockRepositoryWithFallback([]);
          const service = new ProviderMappingService(mockRepository);

          // Act
          const result = await service.resolve(tmdbId, region);

          // Assert
          expect(result).toBeNull();
        }),
        { numRuns: 100 },
      );
    });

    it('should handle batch resolution with mixed region/global mappings', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(tmdbProviderIdArb, { minLength: 2, maxLength: 10 }),
          regionArb,
          async (tmdbIds, region) => {
            // Arrange - unique IDs
            const uniqueIds = [...new Set(tmdbIds)];
            fc.pre(uniqueIds.length >= 2);

            // Create mixed mappings: some region-specific, some global-only
            const mappings: ProviderMapping[] = [];
            const expectedProviders = new Map<number, string>();

            uniqueIds.forEach((id, index) => {
              const providerId = `provider_${id}`;
              const globalProviderId = `global_provider_${id}`;

              if (index % 2 === 0) {
                // Region-specific mapping (should be preferred)
                mappings.push(createMapping(id, providerId, region));
                mappings.push(createMapping(id, globalProviderId, GLOBAL_REGION));
                expectedProviders.set(id, providerId);
              } else {
                // Global-only mapping
                mappings.push(createMapping(id, globalProviderId, GLOBAL_REGION));
                expectedProviders.set(id, globalProviderId);
              }
            });

            const mockRepository = createMockRepositoryWithFallback(mappings);
            const service = new ProviderMappingService(mockRepository);

            // Act
            const results = await service.resolveMany(uniqueIds, region);

            // Assert - each ID should resolve to expected provider
            for (const id of uniqueIds) {
              const result = results.get(id);
              expect(result).not.toBeUndefined();
              expect(result?.providerId).toBe(expectedProviders.get(id));
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

// Helper functions

function createMapping(
  tmdbProviderId: number,
  providerId: string,
  region: string,
): ProviderMapping {
  return {
    id: `mapping-${tmdbProviderId}-${region}`,
    tmdbProviderId,
    providerId,
    variantId: null,
    distributionChannel: 'direct',
    region,
    notes: null,
    source: 'manual',
    createdAt: new Date(),
  };
}

function deduplicateByTmdbAndRegion(mappings: ProviderMapping[]): ProviderMapping[] {
  const seen = new Set<string>();
  return mappings.filter((m) => {
    const key = `${m.tmdbProviderId}:${m.region}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toResolvedMapping(mapping: ProviderMapping): ResolvedMapping {
  return {
    providerId: mapping.providerId,
    variantId: mapping.variantId,
    distributionChannel: mapping.distributionChannel,
  };
}

function createMockRepository(mappings: ProviderMapping[]) {
  return {
    findById: jest.fn(),
    findByRegion: jest.fn(),
    findByTmdbIdAndRegion: jest.fn().mockImplementation((tmdbId: number, region: string) => {
      const found = mappings.find((m) => m.tmdbProviderId === tmdbId && m.region === region);
      return Promise.resolve(found ?? null);
    }),
    findManyByTmdbIdsAndRegion: jest
      .fn()
      .mockImplementation((tmdbIds: number[], region: string) => {
        const map = new Map<number, ProviderMapping>();
        for (const m of mappings) {
          if (tmdbIds.includes(m.tmdbProviderId) && m.region === region) {
            map.set(m.tmdbProviderId, m);
          }
        }
        return Promise.resolve(map);
      }),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    resolve: jest.fn().mockImplementation((tmdbId: number, region: string) => {
      const found = mappings.find((m) => m.tmdbProviderId === tmdbId && m.region === region);
      return Promise.resolve(found ? toResolvedMapping(found) : null);
    }),
    resolveMany: jest.fn().mockImplementation((tmdbIds: number[], region: string) => {
      const map = new Map<number, ResolvedMapping>();
      for (const m of mappings) {
        if (tmdbIds.includes(m.tmdbProviderId) && m.region === region) {
          map.set(m.tmdbProviderId, toResolvedMapping(m));
        }
      }
      return Promise.resolve(map);
    }),
  };
}

function createMockRepositoryWithFallback(mappings: ProviderMapping[]) {
  return {
    findById: jest.fn(),
    findByRegion: jest.fn(),
    findByTmdbIdAndRegion: jest.fn().mockImplementation((tmdbId: number, region: string) => {
      const found = mappings.find((m) => m.tmdbProviderId === tmdbId && m.region === region);
      return Promise.resolve(found ?? null);
    }),
    findManyByTmdbIdsAndRegion: jest
      .fn()
      .mockImplementation((tmdbIds: number[], region: string) => {
        const map = new Map<number, ProviderMapping>();
        for (const m of mappings) {
          if (tmdbIds.includes(m.tmdbProviderId) && m.region === region) {
            map.set(m.tmdbProviderId, m);
          }
        }
        return Promise.resolve(map);
      }),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    resolve: jest.fn().mockImplementation((tmdbId: number, region: string) => {
      // Try region-specific first
      let found = mappings.find((m) => m.tmdbProviderId === tmdbId && m.region === region);
      // Fall back to global
      if (!found && region !== GLOBAL_REGION) {
        found = mappings.find((m) => m.tmdbProviderId === tmdbId && m.region === GLOBAL_REGION);
      }
      return Promise.resolve(found ? toResolvedMapping(found) : null);
    }),
    resolveMany: jest.fn().mockImplementation((tmdbIds: number[], region: string) => {
      const map = new Map<number, ResolvedMapping>();

      // First pass: region-specific
      for (const m of mappings) {
        if (tmdbIds.includes(m.tmdbProviderId) && m.region === region) {
          map.set(m.tmdbProviderId, toResolvedMapping(m));
        }
      }

      // Second pass: global fallback for missing
      if (region !== GLOBAL_REGION) {
        for (const m of mappings) {
          if (
            tmdbIds.includes(m.tmdbProviderId) &&
            m.region === GLOBAL_REGION &&
            !map.has(m.tmdbProviderId)
          ) {
            map.set(m.tmdbProviderId, toResolvedMapping(m));
          }
        }
      }

      return Promise.resolve(map);
    }),
  };
}
