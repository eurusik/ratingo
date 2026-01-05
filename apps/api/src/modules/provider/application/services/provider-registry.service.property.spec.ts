import * as fc from 'fast-check';

import type { Provider } from '../../domain/types/provider.types';
import { ProviderRegistryService } from './provider-registry.service';

describe('Provider Registry Service - Property-Based Tests', () => {
  // Arbitraries (generators) for property-based testing

  const providerIdArb = fc.stringMatching(/^[a-z][a-z0-9-]{2,19}$/);
  const displayNameArb = fc.string({ minLength: 1, maxLength: 50 });
  const brandGroupArb = fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null });
  const logoPathArb = fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null });
  const priorityArb = fc.nat({ max: 1000 });
  const isActiveArb = fc.boolean();
  const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') });

  const providerArb: fc.Arbitrary<Provider> = fc.record({
    id: providerIdArb,
    displayName: displayNameArb,
    brandGroup: brandGroupArb,
    logoPath: logoPathArb,
    priority: priorityArb,
    isActive: isActiveArb,
    createdAt: dateArb,
    updatedAt: dateArb,
  });

  function deduplicateById(providers: Provider[]): Provider[] {
    const seen = new Set<string>();
    return providers.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  function createMockRepository(uniqueProviders: Provider[]) {
    const activeProviders = uniqueProviders.filter((p) => p.isActive);

    return {
      findAll: jest.fn().mockImplementation((options?: { includeInactive?: boolean }) => {
        if (options?.includeInactive) {
          return Promise.resolve([...uniqueProviders]);
        }
        return Promise.resolve([...activeProviders]);
      }),
      findById: jest.fn(),
      findByBrandGroup: jest.fn().mockImplementation((brandGroup: string) => {
        return Promise.resolve(
          uniqueProviders.filter((p) => p.isActive && p.brandGroup === brandGroup),
        );
      }),
      create: jest.fn(),
      update: jest.fn(),
      deactivate: jest.fn(),
    };
  }

  describe('Property 1: Provider Registry Query Correctness', () => {
    it('should return only active providers when includeInactive is false or undefined', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(providerArb, { minLength: 0, maxLength: 50 }),
          async (providers) => {
            // Arrange
            const uniqueProviders = deduplicateById(providers);
            const activeProviders = uniqueProviders.filter((p) => p.isActive);
            const mockRepository = createMockRepository(uniqueProviders);
            const service = new ProviderRegistryService(mockRepository);

            // Act
            const result = await service.findAll();

            // Assert - All returned providers should be active
            expect(result.every((p) => p.isActive)).toBe(true);

            // Assert - Count should match active providers
            expect(result.length).toBe(activeProviders.length);

            // Assert - Should contain exactly the active providers
            const resultIds = new Set(result.map((p) => p.id));
            const activeIds = new Set(activeProviders.map((p) => p.id));
            expect(resultIds).toEqual(activeIds);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return all providers when includeInactive is true', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(providerArb, { minLength: 0, maxLength: 50 }),
          async (providers) => {
            // Arrange
            const uniqueProviders = deduplicateById(providers);
            const mockRepository = createMockRepository(uniqueProviders);
            const service = new ProviderRegistryService(mockRepository);

            // Act
            const result = await service.findAll({ includeInactive: true });

            // Assert - Count should match all providers
            expect(result.length).toBe(uniqueProviders.length);

            // Assert - Should contain both active and inactive
            const resultIds = new Set(result.map((p) => p.id));
            const allIds = new Set(uniqueProviders.map((p) => p.id));
            expect(resultIds).toEqual(allIds);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should maintain consistency: active subset of all', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(providerArb, { minLength: 1, maxLength: 50 }),
          async (providers) => {
            // Arrange
            const uniqueProviders = deduplicateById(providers);
            const mockRepository = createMockRepository(uniqueProviders);
            const service = new ProviderRegistryService(mockRepository);

            // Act
            const [activeResult, allResult] = await Promise.all([
              service.findAll(),
              service.findAll({ includeInactive: true }),
            ]);

            // Assert - Active result should be subset of all result
            const allIds = new Set(allResult.map((p) => p.id));
            const activeIds = activeResult.map((p) => p.id);

            expect(activeIds.every((id) => allIds.has(id))).toBe(true);

            // Assert - Active count should be <= all count
            expect(activeResult.length).toBeLessThanOrEqual(allResult.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 2: Brand Group Filtering', () => {
    it('should return exactly providers matching the brand group', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(providerArb, { minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 30 }),
          async (providers, targetBrandGroup) => {
            // Arrange
            const uniqueProviders = deduplicateById(providers);
            const expectedProviders = uniqueProviders.filter(
              (p) => p.isActive && p.brandGroup === targetBrandGroup,
            );
            const mockRepository = createMockRepository(uniqueProviders);
            const service = new ProviderRegistryService(mockRepository);

            // Act
            const result = await service.findByBrandGroup(targetBrandGroup);

            // Assert - All returned providers should have the target brand group
            expect(result.every((p) => p.brandGroup === targetBrandGroup)).toBe(true);

            // Assert - All returned providers should be active
            expect(result.every((p) => p.isActive)).toBe(true);

            // Assert - Count should match expected
            expect(result.length).toBe(expectedProviders.length);

            // Assert - Should contain exactly the expected providers
            const resultIds = new Set(result.map((p) => p.id));
            const expectedIds = new Set(expectedProviders.map((p) => p.id));
            expect(resultIds).toEqual(expectedIds);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should not return providers with different brand groups', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(providerArb, { minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 30 }),
          async (providers, targetBrandGroup) => {
            // Arrange
            const uniqueProviders = deduplicateById(providers);
            const mockRepository = createMockRepository(uniqueProviders);
            const service = new ProviderRegistryService(mockRepository);

            // Act
            const result = await service.findByBrandGroup(targetBrandGroup);

            // Assert - No provider should have a different brand group
            const hasDifferentBrandGroup = result.some((p) => p.brandGroup !== targetBrandGroup);
            expect(hasDifferentBrandGroup).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return empty array when no providers match brand group', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(providerArb, { minLength: 0, maxLength: 20 }),
          async (providers) => {
            // Arrange
            const uniqueProviders = deduplicateById(providers);
            const nonExistentBrandGroup = 'non-existent-brand-group-xyz-123';
            const mockRepository = createMockRepository(uniqueProviders);
            const service = new ProviderRegistryService(mockRepository);

            // Act
            const result = await service.findByBrandGroup(nonExistentBrandGroup);

            // Assert
            expect(result).toEqual([]);
            expect(result.length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should exclude inactive providers even if brand group matches', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.array(providerArb, { minLength: 1, maxLength: 20 }),
          async (targetBrandGroup, providers) => {
            // Arrange - Force some providers to have the target brand group but be inactive
            const modifiedProviders = providers.map((p, index) => ({
              ...p,
              id: `provider-${index}`,
              brandGroup: index % 2 === 0 ? targetBrandGroup : p.brandGroup,
              isActive: index % 3 !== 0, // Every 3rd provider is inactive
            }));

            const mockRepository = createMockRepository(modifiedProviders);
            const service = new ProviderRegistryService(mockRepository);

            // Act
            const result = await service.findByBrandGroup(targetBrandGroup);

            // Assert - All returned should be active
            expect(result.every((p) => p.isActive)).toBe(true);

            // Assert - Count inactive with matching brand group
            const inactiveWithBrandGroup = modifiedProviders.filter(
              (p) => !p.isActive && p.brandGroup === targetBrandGroup,
            );

            // Assert - None of the inactive providers should be in result
            const resultIds = new Set(result.map((p) => p.id));
            const hasInactive = inactiveWithBrandGroup.some((p) => resultIds.has(p.id));
            expect(hasInactive).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property: Query Determinism', () => {
    it('should produce identical results for identical queries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(providerArb, { minLength: 0, maxLength: 30 }),
          async (providers) => {
            // Arrange
            const uniqueProviders = deduplicateById(providers);
            const mockRepository = createMockRepository(uniqueProviders);
            const service = new ProviderRegistryService(mockRepository);

            // Act - call twice
            const [result1, result2] = await Promise.all([service.findAll(), service.findAll()]);

            // Assert - Results should be identical
            expect(result1.length).toBe(result2.length);
            expect(result1.map((p) => p.id).sort()).toEqual(result2.map((p) => p.id).sort());
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
