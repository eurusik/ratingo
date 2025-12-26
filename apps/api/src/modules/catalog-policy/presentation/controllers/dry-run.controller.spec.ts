/**
 * Dry-Run Controller Tests
 *
 * Unit tests for DryRunController endpoints:
 * - POST /admin/catalog-policies/dry-run
 * - POST /admin/catalog-policies/dry-run/diff
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DryRunController } from './dry-run.controller';
import { DryRunService } from '../../application/services/dry-run.service';

describe('DryRunController', () => {
  let controller: DryRunController;
  let mockDryRunService: any;

  beforeEach(async () => {
    mockDryRunService = {
      execute: jest.fn(),
      executeDiff: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DryRunController],
      providers: [{ provide: DryRunService, useValue: mockDryRunService }],
    }).compile();

    controller = module.get<DryRunController>(DryRunController);
  });

  const createValidDto = () => ({
    policy: {
      allowedCountries: ['US', 'GB'],
      blockedCountries: ['RU'],
      blockedCountryMode: 'ANY' as const,
      allowedLanguages: ['en'],
      blockedLanguages: ['ru'],
      globalProviders: ['Netflix'],
      breakoutRules: [],
      eligibilityMode: 'STRICT' as const,
      homepage: { minRelevanceScore: 50 },
    },
    options: {
      mode: 'sample' as const,
      limit: 100,
    },
  });

  describe('executeDryRun', () => {
    it('should execute dry-run and return results', async () => {
      const dto = createValidDto();

      mockDryRunService.execute.mockResolvedValue({
        summary: {
          total: 100,
          eligible: 80,
          ineligible: 15,
          pending: 5,
        },
        items: [
          {
            mediaItemId: 'item-1',
            title: 'Test Movie',
            currentStatus: 'ineligible',
            proposedStatus: 'eligible',
            reasons: ['ALLOWED_COUNTRY'],
            relevanceScore: 75,
            breakoutRuleId: null,
            statusChanged: true,
          },
        ],
      });

      const result = await controller.executeDryRun(dto);

      expect(result.summary).toEqual({
        total: 100,
        eligible: 80,
        ineligible: 15,
        pending: 5,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].statusChanged).toBe(true);
    });

    it('should pass normalized policy to service', async () => {
      const dto = createValidDto();
      dto.policy.allowedCountries = ['us', 'gb']; // lowercase

      mockDryRunService.execute.mockResolvedValue({
        summary: { total: 0, eligible: 0, ineligible: 0, pending: 0 },
        items: [],
      });

      await controller.executeDryRun(dto);

      // Verify policy was normalized (uppercase countries)
      expect(mockDryRunService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          allowedCountries: ['US', 'GB'],
        }),
        expect.any(Object),
      );
    });

    it('should apply default values for optional policy fields', async () => {
      const dto = {
        policy: {
          allowedCountries: ['US'],
          blockedCountries: [],
          allowedLanguages: ['en'],
          blockedLanguages: [],
        },
        options: {
          mode: 'sample' as const,
          limit: 10,
        },
      };

      mockDryRunService.execute.mockResolvedValue({
        summary: { total: 0, eligible: 0, ineligible: 0, pending: 0 },
        items: [],
      });

      await controller.executeDryRun(dto as any);

      expect(mockDryRunService.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          blockedCountryMode: 'ANY',
          globalProviders: [],
          breakoutRules: [],
          eligibilityMode: 'STRICT',
          homepage: { minRelevanceScore: 50 },
        }),
        expect.any(Object),
      );
    });
  });

  describe('executeDryRunDiff', () => {
    it('should execute dry-run with diff and return results', async () => {
      const dto = createValidDto();

      mockDryRunService.executeDiff.mockResolvedValue({
        summary: {
          total: 100,
          eligible: 80,
          ineligible: 15,
          pending: 5,
        },
        items: [
          {
            mediaItemId: 'item-1',
            title: 'Test Movie',
            currentStatus: 'ineligible',
            proposedStatus: 'eligible',
            reasons: ['ALLOWED_COUNTRY'],
            relevanceScore: 75,
            breakoutRuleId: null,
            statusChanged: true,
          },
        ],
        currentPolicyVersion: 1,
      });

      const result = await controller.executeDryRunDiff(dto);

      expect(result.currentPolicyVersion).toBe(1);
      expect(result.items).toHaveLength(1);
    });

    it('should pass all options to service', async () => {
      const dto = {
        ...createValidDto(),
        options: {
          mode: 'byCountry' as const,
          limit: 500,
          country: 'US',
          mediaType: 'movie' as const,
          samplePercent: 10,
        },
      };

      mockDryRunService.executeDiff.mockResolvedValue({
        summary: { total: 0, eligible: 0, ineligible: 0, pending: 0 },
        items: [],
        currentPolicyVersion: 1,
      });

      await controller.executeDryRunDiff(dto);

      expect(mockDryRunService.executeDiff).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          mode: 'byCountry',
          limit: 500,
          country: 'US',
          mediaType: 'movie',
          samplePercent: 10,
        }),
      );
    });
  });
});
