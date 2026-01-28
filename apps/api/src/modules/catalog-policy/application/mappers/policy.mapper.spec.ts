/**
 * Policy Mapper Tests
 *
 * Unit tests for PolicyMapper functions.
 */

import { PolicyMapper } from './policy.mapper';
import { type CatalogPolicy } from '../../domain/types/policy.types';

describe('PolicyMapper', () => {
  const createMockPolicy = (overrides: Partial<CatalogPolicy> = {}): CatalogPolicy => ({
    id: 'policy-123',
    version: 2,
    isActive: true,
    policy: {
      allowedCountries: ['US', 'GB', 'UA'],
      blockedCountries: ['RU', 'BY'],
      blockedCountryMode: 'ANY',
      allowedLanguages: ['en', 'uk'],
      blockedLanguages: ['ru'],
      globalProviders: ['netflix', 'prime'],
      breakoutRules: [],
      eligibilityMode: 'STRICT',
      homepage: { minRelevanceScore: 50 },
    },
    createdAt: new Date('2024-01-01T10:00:00Z'),
    activatedAt: new Date('2024-01-02T12:00:00Z'),
    ...overrides,
  });

  describe('toListDto', () => {
    it('should map active policy to list DTO', () => {
      const policy = createMockPolicy();

      const result = PolicyMapper.toListDto(policy);

      expect(result).toEqual({
        id: 'policy-123',
        name: 'Policy v2',
        version: '2',
        status: 'active',
        description: 'STRICT mode, 3 allowed countries',
        updatedAt: new Date('2024-01-02T12:00:00Z'),
      });
    });

    it('should map inactive policy to list DTO', () => {
      const policy = createMockPolicy({ isActive: false, activatedAt: null });

      const result = PolicyMapper.toListDto(policy);

      expect(result.status).toBe('inactive');
      expect(result.updatedAt).toEqual(new Date('2024-01-01T10:00:00Z'));
    });

    it('should return undefined description when no eligibilityMode', () => {
      const policy = createMockPolicy({
        policy: {
          allowedCountries: [],
          blockedCountries: [],
          blockedCountryMode: 'ANY',
          allowedLanguages: [],
          blockedLanguages: [],
          globalProviders: [],
          breakoutRules: [],
          eligibilityMode: undefined as unknown as 'STRICT',
          homepage: { minRelevanceScore: 0 },
        },
      });

      const result = PolicyMapper.toListDto(policy);

      expect(result.description).toBeUndefined();
    });
  });

  describe('toDetailDto', () => {
    it('should map policy to detail DTO with full config', () => {
      const policy = createMockPolicy();

      const result = PolicyMapper.toDetailDto(policy);

      expect(result.id).toBe('policy-123');
      expect(result.name).toBe('Policy v2');
      expect(result.version).toBe('2');
      expect(result.status).toBe('active');
      expect(result.createdAt).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(result.activatedAt).toEqual(new Date('2024-01-02T12:00:00Z'));
      expect(result.config).toEqual(policy.policy);
    });

    it('should not include activatedAt when null', () => {
      const policy = createMockPolicy({ activatedAt: null });

      const result = PolicyMapper.toDetailDto(policy);

      expect(result.activatedAt).toBeUndefined();
      expect('activatedAt' in result).toBe(false);
    });

    it('should map inactive policy status', () => {
      const policy = createMockPolicy({ isActive: false });

      const result = PolicyMapper.toDetailDto(policy);

      expect(result.status).toBe('inactive');
    });
  });

  describe('toListDtos', () => {
    it('should map multiple policies', () => {
      const policies = [
        createMockPolicy({ id: 'policy-1', version: 1 }),
        createMockPolicy({ id: 'policy-2', version: 2, isActive: false }),
      ];

      const result = PolicyMapper.toListDtos(policies);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('policy-1');
      expect(result[0].name).toBe('Policy v1');
      expect(result[1].id).toBe('policy-2');
      expect(result[1].status).toBe('inactive');
    });

    it('should return empty array for empty input', () => {
      const result = PolicyMapper.toListDtos([]);

      expect(result).toEqual([]);
    });
  });

  describe('formatDisplayName', () => {
    it('should format version as display name', () => {
      expect(PolicyMapper.formatDisplayName(1)).toBe('Policy v1');
      expect(PolicyMapper.formatDisplayName(42)).toBe('Policy v42');
    });
  });

  describe('resolveStatus', () => {
    it('should return active for true', () => {
      expect(PolicyMapper.resolveStatus(true)).toBe('active');
    });

    it('should return inactive for false', () => {
      expect(PolicyMapper.resolveStatus(false)).toBe('inactive');
    });
  });

  describe('formatSummary', () => {
    it('should format summary with country count', () => {
      const result = PolicyMapper.formatSummary({
        eligibilityMode: 'RELAXED',
        allowedCountries: ['US', 'GB'],
      } as CatalogPolicy['policy']);

      expect(result).toBe('RELAXED mode, 2 allowed countries');
    });

    it('should handle zero countries', () => {
      const result = PolicyMapper.formatSummary({
        eligibilityMode: 'STRICT',
        allowedCountries: [],
      } as CatalogPolicy['policy']);

      expect(result).toBe('STRICT mode, 0 allowed countries');
    });

    it('should handle undefined allowedCountries', () => {
      const result = PolicyMapper.formatSummary({
        eligibilityMode: 'STRICT',
      } as CatalogPolicy['policy']);

      expect(result).toBe('STRICT mode, 0 allowed countries');
    });
  });
});
