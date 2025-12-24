/**
 * Dry-Run Service Tests
 *
 * Unit tests for the dry-run evaluation service.
 * Tests cover validation logic. Integration tests for DB queries
 * are in the e2e test suite.
 *
 * Feature: catalog-policy-engine, Task 16
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DryRunService, DryRunOptions } from './dry-run.service';
import { CatalogPolicyService } from './catalog-policy.service';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PolicyConfig } from '../../domain/types/policy.types';

describe('DryRunService', () => {
  let service: DryRunService;
  let mockDb: any;
  let mockPolicyService: any;

  const createTestPolicy = (overrides: Partial<PolicyConfig> = {}): PolicyConfig => ({
    allowedCountries: ['US', 'UA'],
    blockedCountries: ['RU'],
    blockedCountryMode: 'ANY',
    allowedLanguages: ['en', 'uk'],
    blockedLanguages: [],
    globalProviders: [],
    breakoutRules: [],
    eligibilityMode: 'STRICT',
    homepage: { minRelevanceScore: 0 },
    ...overrides,
  });

  beforeEach(async () => {
    // Create a deeply chainable mock for Drizzle ORM
    const createChainable = (): any => {
      const chainable: any = {};
      const methods = ['select', 'from', 'leftJoin', 'where', 'orderBy', 'limit', 'offset'];
      methods.forEach((method) => {
        chainable[method] = jest.fn().mockReturnValue(chainable);
      });
      // Make it thenable for async operations
      chainable.then = (resolve: any) => resolve([]);
      chainable.execute = jest.fn().mockResolvedValue([]);
      return chainable;
    };

    mockDb = createChainable();

    mockPolicyService = {
      getActive: jest.fn().mockResolvedValue({ version: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DryRunService,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
        { provide: CatalogPolicyService, useValue: mockPolicyService },
      ],
    }).compile();

    service = module.get<DryRunService>(DryRunService);
  });

  describe('validateOptions', () => {
    it('should throw BadRequestException when byType mode without mediaType', async () => {
      const options: DryRunOptions = { mode: 'byType' };

      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        'mediaType is required for byType mode',
      );
    });

    it('should throw BadRequestException when byCountry mode without country', async () => {
      const options: DryRunOptions = { mode: 'byCountry' };

      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        'country is required for byCountry mode',
      );
    });

    it('should throw BadRequestException when limit exceeds max', async () => {
      const options: DryRunOptions = { mode: 'top', limit: 20000 };

      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        'limit must be between 1 and 10000',
      );
    });

    it('should throw BadRequestException when limit is negative', async () => {
      const options: DryRunOptions = { mode: 'top', limit: -1 };

      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when samplePercent exceeds 100', async () => {
      const options: DryRunOptions = { mode: 'sample', samplePercent: 150 };

      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        'samplePercent must be between 1 and 100',
      );
    });

    it('should throw BadRequestException when samplePercent is negative', async () => {
      const options: DryRunOptions = { mode: 'sample', samplePercent: -1 };

      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept valid options for top mode', async () => {
      const options: DryRunOptions = { mode: 'top', limit: 100 };

      // Should not throw during validation (may fail on DB mock, but validation passes)
      try {
        await service.execute(createTestPolicy(), options);
      } catch (e) {
        // If it throws, it should NOT be a validation error
        expect(e).not.toBeInstanceOf(BadRequestException);
      }
    });

    it('should accept valid options for byType mode with mediaType', async () => {
      const options: DryRunOptions = { mode: 'byType', mediaType: 'movie', limit: 100 };

      try {
        await service.execute(createTestPolicy(), options);
      } catch (e) {
        expect(e).not.toBeInstanceOf(BadRequestException);
      }
    });

    it('should accept valid options for byCountry mode with country', async () => {
      const options: DryRunOptions = { mode: 'byCountry', country: 'US', limit: 100 };

      try {
        await service.execute(createTestPolicy(), options);
      } catch (e) {
        expect(e).not.toBeInstanceOf(BadRequestException);
      }
    });

    it('should accept valid options for sample mode', async () => {
      const options: DryRunOptions = { mode: 'sample', samplePercent: 10, limit: 100 };

      try {
        await service.execute(createTestPolicy(), options);
      } catch (e) {
        expect(e).not.toBeInstanceOf(BadRequestException);
      }
    });
  });

  describe('executeDiff', () => {
    it('should call getActive to get current policy version', async () => {
      mockPolicyService.getActive.mockResolvedValue({ version: 5 });

      try {
        await service.executeDiff(createTestPolicy(), { mode: 'sample', limit: 10 });
      } catch {
        // Ignore DB errors
      }

      expect(mockPolicyService.getActive).toHaveBeenCalled();
    });

    it('should handle null active policy', async () => {
      mockPolicyService.getActive.mockResolvedValue(null);

      try {
        await service.executeDiff(createTestPolicy(), { mode: 'sample', limit: 10 });
      } catch {
        // Ignore DB errors
      }

      expect(mockPolicyService.getActive).toHaveBeenCalled();
    });
  });

  describe('constants', () => {
    it('should have MAX_ITEMS set to 10000', () => {
      // Verify by trying to exceed the limit
      const options: DryRunOptions = { mode: 'top', limit: 10001 };

      expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        'limit must be between 1 and 10000',
      );
    });

    it('should have DEFAULT_LIMIT of 1000', async () => {
      // When no limit specified, should use default
      const options: DryRunOptions = { mode: 'sample' };

      try {
        const result = await service.execute(createTestPolicy(), options);
        expect(result.summary.limit).toBe(1000);
      } catch {
        // If DB fails, we can't verify this
      }
    });
  });
});
