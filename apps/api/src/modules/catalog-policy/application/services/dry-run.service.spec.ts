/**
 * Dry-Run Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DryRunService, DryRunOptions } from './dry-run.service';
import { CatalogPolicyService } from './catalog-policy.service';
import { PolicyConfig } from '../../domain/types/policy.types';
import { MEDIA_WATCH_OFFERS_REPOSITORY } from '../../../provider/public';
import { DRY_RUN_REPOSITORY } from '../../domain/repositories';
import {
  MissingModeParameterError,
  InvalidLimitError,
  InvalidSamplePercentError,
  UnknownDryRunModeError,
} from '../../domain/errors';

describe('DryRunService', () => {
  let service: DryRunService;
  let mockDryRunRepository: any;
  let mockPolicyService: any;
  let mockWatchOffersRepository: any;

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
    mockDryRunRepository = {
      fetchSampleItems: jest.fn().mockResolvedValue([]),
      fetchTopItems: jest.fn().mockResolvedValue([]),
      fetchByTypeItems: jest.fn().mockResolvedValue([]),
      fetchByCountryItems: jest.fn().mockResolvedValue([]),
      getCurrentEvaluations: jest.fn().mockResolvedValue(new Map()),
    };

    mockPolicyService = {
      getActive: jest.fn().mockResolvedValue({ version: 1 }),
    };

    mockWatchOffersRepository = {
      getOffersForMediaBatch: jest.fn().mockResolvedValue(new Map()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DryRunService,
        { provide: DRY_RUN_REPOSITORY, useValue: mockDryRunRepository },
        { provide: CatalogPolicyService, useValue: mockPolicyService },
        { provide: MEDIA_WATCH_OFFERS_REPOSITORY, useValue: mockWatchOffersRepository },
      ],
    }).compile();

    service = module.get<DryRunService>(DryRunService);
  });

  describe('validateOptions', () => {
    it('should throw MissingModeParameterError when byType mode without mediaType', async () => {
      const options: DryRunOptions = { mode: 'byType' };

      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        MissingModeParameterError,
      );
      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        "Parameter 'mediaType' is required for 'byType' mode",
      );
    });

    it('should throw MissingModeParameterError when byCountry mode without country', async () => {
      const options: DryRunOptions = { mode: 'byCountry' };

      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        MissingModeParameterError,
      );
      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        "Parameter 'country' is required for 'byCountry' mode",
      );
    });

    it('should throw InvalidLimitError when limit exceeds max', async () => {
      const options: DryRunOptions = { mode: 'top', limit: 20000 };

      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(InvalidLimitError);
      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        'Limit must be between 1 and 10000, got 20000',
      );
    });

    it('should throw InvalidLimitError when limit is negative', async () => {
      const options: DryRunOptions = { mode: 'top', limit: -1 };

      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(InvalidLimitError);
    });

    it('should throw InvalidSamplePercentError when samplePercent exceeds 100', async () => {
      const options: DryRunOptions = { mode: 'sample', samplePercent: 150 };

      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        InvalidSamplePercentError,
      );
      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        'Sample percent must be between 1 and 100, got 150',
      );
    });

    it('should throw InvalidSamplePercentError when samplePercent is negative', async () => {
      const options: DryRunOptions = { mode: 'sample', samplePercent: -1 };

      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        InvalidSamplePercentError,
      );
    });

    it('should accept valid options for top mode', async () => {
      const options: DryRunOptions = { mode: 'top', limit: 100 };

      const result = await service.execute(createTestPolicy(), options);

      expect(result.summary.totalEvaluated).toBe(0);
      expect(mockDryRunRepository.fetchTopItems).toHaveBeenCalledWith(100);
    });

    it('should accept valid options for byType mode with mediaType', async () => {
      const options: DryRunOptions = { mode: 'byType', mediaType: 'movie', limit: 100 };

      const result = await service.execute(createTestPolicy(), options);

      expect(result.summary.totalEvaluated).toBe(0);
      expect(mockDryRunRepository.fetchByTypeItems).toHaveBeenCalled();
    });

    it('should accept valid options for byCountry mode with country', async () => {
      const options: DryRunOptions = { mode: 'byCountry', country: 'US', limit: 100 };

      const result = await service.execute(createTestPolicy(), options);

      expect(result.summary.totalEvaluated).toBe(0);
      expect(mockDryRunRepository.fetchByCountryItems).toHaveBeenCalledWith('US', 100);
    });

    it('should accept valid options for sample mode', async () => {
      const options: DryRunOptions = { mode: 'sample', samplePercent: 10, limit: 100 };

      const result = await service.execute(createTestPolicy(), options);

      expect(result.summary.totalEvaluated).toBe(0);
      expect(mockDryRunRepository.fetchSampleItems).toHaveBeenCalledWith(100, 10);
    });
  });

  describe('executeDiff', () => {
    it('should call getActive to get current policy version', async () => {
      mockPolicyService.getActive.mockResolvedValue({ version: 5 });

      const result = await service.executeDiff(createTestPolicy(), { mode: 'sample', limit: 10 });

      expect(mockPolicyService.getActive).toHaveBeenCalled();
      expect(result.currentPolicyVersion).toBe(5);
    });

    it('should handle null active policy', async () => {
      mockPolicyService.getActive.mockResolvedValue(null);

      const result = await service.executeDiff(createTestPolicy(), { mode: 'sample', limit: 10 });

      expect(mockPolicyService.getActive).toHaveBeenCalled();
      expect(result.currentPolicyVersion).toBeNull();
    });
  });

  describe('constants', () => {
    it('should have MAX_ITEMS set to 10000', async () => {
      const options: DryRunOptions = { mode: 'top', limit: 10001 };

      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        'Limit must be between 1 and 10000, got 10001',
      );
    });

    it('should have DEFAULT_LIMIT of 1000', async () => {
      const options: DryRunOptions = { mode: 'sample' };

      const result = await service.execute(createTestPolicy(), options);

      expect(result.summary.limit).toBe(1000);
    });
  });

  describe('summary fields', () => {
    it('should include timedOut field in summary', async () => {
      const options: DryRunOptions = { mode: 'top', limit: 10 };

      const result = await service.execute(createTestPolicy(), options);

      expect(result.summary.timedOut).toBe(false);
    });

    it('should include newItems field in summary', async () => {
      const options: DryRunOptions = { mode: 'top', limit: 10 };

      const result = await service.execute(createTestPolicy(), options);

      expect(result.summary.newItems).toBe(0);
    });
  });

  describe('unknown mode', () => {
    it('should throw UnknownDryRunModeError for invalid mode', async () => {
      const options = { mode: 'invalid' as any, limit: 10 };

      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        UnknownDryRunModeError,
      );
      await expect(service.execute(createTestPolicy(), options)).rejects.toThrow(
        "Unknown dry-run mode: 'invalid'",
      );
    });
  });

  describe('evaluation with items', () => {
    const createTestItem = (id: string, overrides: Record<string, unknown> = {}) => ({
      id,
      title: `Test Item ${id}`,
      overview: 'Test overview',
      originCountries: ['US'],
      originalLanguage: 'en',
      contentClass: 'GENERAL',
      ratingImdb: 7.5,
      ratingMetacritic: null,
      ratingRottenTomatoes: null,
      ratingTrakt: null,
      voteCountImdb: 1000,
      voteCountTrakt: null,
      qualityScore: 70,
      popularityScore: 60,
      freshnessScore: 50,
      ratingoScore: 65,
      ...overrides,
    });

    it('should evaluate items and count eligible/ineligible', async () => {
      const items = [
        createTestItem('1', { originCountries: ['US'], originalLanguage: 'en' }),
        createTestItem('2', { originCountries: ['RU'], originalLanguage: 'ru' }),
      ];
      mockDryRunRepository.fetchTopItems.mockResolvedValue(items);

      const policy = createTestPolicy({
        allowedCountries: ['US'],
        blockedCountries: ['RU'],
        allowedLanguages: ['en'],
      });

      const result = await service.execute(policy, { mode: 'top', limit: 10 });

      expect(result.summary.totalEvaluated).toBe(2);
      expect(result.items).toHaveLength(2);
    });

    it('should track newItems for items without previous evaluation', async () => {
      const items = [createTestItem('1'), createTestItem('2')];
      mockDryRunRepository.fetchTopItems.mockResolvedValue(items);
      mockDryRunRepository.getCurrentEvaluations.mockResolvedValue(new Map());

      const result = await service.execute(createTestPolicy(), { mode: 'top', limit: 10 });

      expect(result.summary.newItems).toBe(2);
    });

    it('should track unchanged for items with same status', async () => {
      const items = [createTestItem('1', { originCountries: ['US'], originalLanguage: 'en' })];
      mockDryRunRepository.fetchTopItems.mockResolvedValue(items);

      // First run to get actual proposed status
      const firstResult = await service.execute(createTestPolicy(), { mode: 'top', limit: 10 });
      const proposedStatus = firstResult.items[0].proposedStatus;

      // Now mock previous evaluation with same status
      mockDryRunRepository.getCurrentEvaluations.mockResolvedValue(
        new Map([['1', { mediaItemId: '1', status: proposedStatus }]]),
      );

      const result = await service.execute(createTestPolicy(), { mode: 'top', limit: 10 });

      expect(result.summary.unchanged).toBe(1);
      expect(result.summary.newItems).toBe(0);
      expect(result.items[0].statusChanged).toBe(false);
    });

    it('should track newlyEligible when status changes to ELIGIBLE', async () => {
      const items = [createTestItem('1', { originCountries: ['US'], originalLanguage: 'en' })];
      mockDryRunRepository.fetchTopItems.mockResolvedValue(items);
      mockDryRunRepository.getCurrentEvaluations.mockResolvedValue(
        new Map([['1', { mediaItemId: '1', status: 'INELIGIBLE' }]]),
      );

      const result = await service.execute(createTestPolicy(), { mode: 'top', limit: 10 });

      expect(result.summary.newlyEligible).toBe(1);
      expect(result.items[0].statusChanged).toBe(true);
    });

    it('should include reasons in item results', async () => {
      const items = [createTestItem('1', { originCountries: ['US'], originalLanguage: 'en' })];
      mockDryRunRepository.fetchTopItems.mockResolvedValue(items);

      const result = await service.execute(createTestPolicy(), { mode: 'top', limit: 10 });

      expect(result.items[0].reasons).toBeDefined();
      expect(Array.isArray(result.items[0].reasons)).toBe(true);
    });

    it('should include relevanceScore in item results', async () => {
      const items = [createTestItem('1')];
      mockDryRunRepository.fetchTopItems.mockResolvedValue(items);

      const result = await service.execute(createTestPolicy(), { mode: 'top', limit: 10 });

      expect(typeof result.items[0].relevanceScore).toBe('number');
    });

    it('should build reason breakdown from all evaluated items', async () => {
      const items = [
        createTestItem('1', { originCountries: ['US'], originalLanguage: 'en' }),
        createTestItem('2', { originCountries: ['US'], originalLanguage: 'en' }),
      ];
      mockDryRunRepository.fetchTopItems.mockResolvedValue(items);

      const result = await service.execute(createTestPolicy(), { mode: 'top', limit: 10 });

      expect(result.summary.reasonBreakdown).toBeDefined();
      expect(Array.isArray(result.summary.reasonBreakdown)).toBe(true);
    });
  });
});
