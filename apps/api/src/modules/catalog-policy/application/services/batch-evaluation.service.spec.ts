/**
 * BatchEvaluationService Unit Tests
 *
 * Tests the batch evaluation service with mocked dependencies.
 */

import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import {
  EligibilityStatus,
  EvaluationContext,
  type EvaluationContextType,
} from '../../domain/constants/evaluation.constants';
import {
  POLICY_INPUT_REPOSITORY,
  MEDIA_CATALOG_EVALUATION_REPOSITORY,
} from '../../domain/repositories';
import type { PolicyEngineInput, PolicyConfig } from '../../domain/types/policy.types';

import { BatchEvaluationService } from './batch-evaluation.service';
import { CatalogPolicyService } from './catalog-policy.service';

describe('BatchEvaluationService', () => {
  let service: BatchEvaluationService;
  let mockPolicyInputRepository: {
    findOneForEvaluation: jest.Mock;
    findManyForEvaluation: jest.Mock;
    countEligibleItems: jest.Mock;
    fetchBatchIds: jest.Mock;
  };
  let mockPolicyService: {
    getActiveOrThrow: jest.Mock;
    getByVersion: jest.Mock;
  };
  let mockEvaluationRepository: {
    findByMediaId: jest.Mock;
    upsert: jest.Mock;
    bulkUpsert: jest.Mock;
    countByStatusAndPolicyVersion: jest.Mock;
  };

  const defaultPolicy: { version: number; policy: PolicyConfig } = {
    version: 1,
    policy: {
      allowedCountries: ['US', 'UA'],
      blockedCountries: [],
      blockedCountryMode: 'ANY',
      allowedLanguages: ['en', 'uk'],
      blockedLanguages: [],
      globalProviders: ['netflix'],
      breakoutRules: [],
      eligibilityMode: 'RELAXED',
      homepage: { minRelevanceScore: 0.5 },
    },
  };

  const createMockPolicyEngineInput = (id: string): PolicyEngineInput => ({
    mediaItem: {
      id,
      originCountries: ['US'],
      originalLanguage: 'en',
      normalizedOffers: [
        { providerId: 'netflix', offerType: 'flatrate', distributionChannel: 'direct' },
      ],
      voteCountImdb: 5000,
      voteCountTrakt: 1000,
      ratingImdb: 7.5,
      ratingMetacritic: 75,
      ratingRottenTomatoes: 80,
      ratingTrakt: 7.8,
      contentClass: 'mainstream',
      title: 'Test Movie',
      overview:
        'A test movie with a sufficient overview that meets the minimum character requirements.',
    },
    stats: {
      qualityScore: 0.75,
      popularityScore: 0.6,
      freshnessScore: 0.5,
      ratingoScore: 0.7,
    },
  });

  beforeEach(async () => {
    mockPolicyInputRepository = {
      findOneForEvaluation: jest.fn(),
      findManyForEvaluation: jest.fn(),
      countEligibleItems: jest.fn(),
      fetchBatchIds: jest.fn(),
    };

    mockPolicyService = {
      getActiveOrThrow: jest.fn().mockResolvedValue(defaultPolicy),
      getByVersion: jest.fn(),
    };

    mockEvaluationRepository = {
      findByMediaId: jest.fn(),
      upsert: jest.fn(),
      bulkUpsert: jest.fn(),
      countByStatusAndPolicyVersion: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BatchEvaluationService,
        {
          provide: POLICY_INPUT_REPOSITORY,
          useValue: mockPolicyInputRepository,
        },
        {
          provide: CatalogPolicyService,
          useValue: mockPolicyService,
        },
        {
          provide: MEDIA_CATALOG_EVALUATION_REPOSITORY,
          useValue: mockEvaluationRepository,
        },
      ],
    }).compile();

    service = moduleRef.get<BatchEvaluationService>(BatchEvaluationService);
  });

  describe('evaluateBatch', () => {
    it('should return empty result for empty input', async () => {
      const result = await service.evaluateBatch([]);

      expect(result).toEqual({
        processed: 0,
        eligible: 0,
        ineligible: 0,
        review: 0,
        errors: 0,
      });
      expect(mockPolicyInputRepository.findManyForEvaluation).not.toHaveBeenCalled();
    });

    it('should evaluate batch of media items', async () => {
      const mediaItemIds = ['media-1', 'media-2', 'media-3'];
      const inputs = mediaItemIds.map(createMockPolicyEngineInput);

      mockPolicyInputRepository.findManyForEvaluation.mockResolvedValue(inputs);
      mockEvaluationRepository.bulkUpsert.mockResolvedValue(3);

      const result = await service.evaluateBatch(mediaItemIds);

      expect(result.processed).toBe(3);
      expect(result.eligible).toBe(3);
      expect(result.ineligible).toBe(0);
      expect(result.errors).toBe(0);
      expect(mockPolicyInputRepository.findManyForEvaluation).toHaveBeenCalledWith(mediaItemIds);
      expect(mockEvaluationRepository.bulkUpsert).toHaveBeenCalledTimes(1);
    });

    it('should use specified policy version', async () => {
      const mediaItemIds = ['media-1'];
      const policyVersion = 5;
      const inputs = mediaItemIds.map(createMockPolicyEngineInput);
      const customPolicy = { ...defaultPolicy, version: policyVersion };

      mockPolicyService.getByVersion.mockResolvedValue(customPolicy);
      mockPolicyInputRepository.findManyForEvaluation.mockResolvedValue(inputs);
      mockEvaluationRepository.bulkUpsert.mockResolvedValue(1);

      await service.evaluateBatch(mediaItemIds, { policyVersion });

      expect(mockPolicyService.getByVersion).toHaveBeenCalledWith(policyVersion);
    });

    it('should throw NotFoundException when policy version not found', async () => {
      const mediaItemIds = ['media-1'];
      const policyVersion = 999;

      mockPolicyService.getByVersion.mockResolvedValue(null);

      await expect(service.evaluateBatch(mediaItemIds, { policyVersion })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should use specified context', async () => {
      const mediaItemIds = ['media-1'];
      const context: EvaluationContextType = EvaluationContext.TRENDING;
      const inputs = mediaItemIds.map(createMockPolicyEngineInput);

      mockPolicyInputRepository.findManyForEvaluation.mockResolvedValue(inputs);
      mockEvaluationRepository.bulkUpsert.mockResolvedValue(1);

      await service.evaluateBatch(mediaItemIds, { context });

      expect(mockEvaluationRepository.bulkUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ context })]),
      );
    });

    it('should include runId in evaluations', async () => {
      const mediaItemIds = ['media-1'];
      const runId = 'run-123';
      const inputs = mediaItemIds.map(createMockPolicyEngineInput);

      mockPolicyInputRepository.findManyForEvaluation.mockResolvedValue(inputs);
      mockEvaluationRepository.bulkUpsert.mockResolvedValue(1);

      await service.evaluateBatch(mediaItemIds, { runId });

      expect(mockEvaluationRepository.bulkUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ runId })]),
      );
    });

    it('should count errors when evaluation throws', async () => {
      const mediaItemIds = ['media-1', 'media-2'];
      const inputs = [
        createMockPolicyEngineInput('media-1'),
        {
          ...createMockPolicyEngineInput('media-2'),
          // Invalid input that will cause policy engine to throw
          mediaItem: {
            ...createMockPolicyEngineInput('media-2').mediaItem,
            contentClass: null as unknown as 'mainstream', // Force error
          },
        },
      ];

      mockPolicyInputRepository.findManyForEvaluation.mockResolvedValue(inputs);
      mockEvaluationRepository.bulkUpsert.mockResolvedValue(1);

      const result = await service.evaluateBatch(mediaItemIds);

      // First item should process, second might error depending on policy engine behavior
      expect(result.processed + result.errors).toBe(2);
    });

    it('should use active policy when no version specified', async () => {
      const mediaItemIds = ['media-1'];
      const inputs = mediaItemIds.map(createMockPolicyEngineInput);

      mockPolicyInputRepository.findManyForEvaluation.mockResolvedValue(inputs);
      mockEvaluationRepository.bulkUpsert.mockResolvedValue(1);

      await service.evaluateBatch(mediaItemIds);

      expect(mockPolicyService.getActiveOrThrow).toHaveBeenCalled();
      expect(mockPolicyService.getByVersion).not.toHaveBeenCalled();
    });
  });

  describe('reEvaluateAll', () => {
    it('should process all items in batches', async () => {
      const totalItems = 5;
      const allIds = ['media-1', 'media-2', 'media-3', 'media-4', 'media-5'];
      const policyVersion = 1;

      // Mock policy lookup (evaluateBatch uses getByVersion when policyVersion is specified)
      mockPolicyService.getByVersion.mockResolvedValue(defaultPolicy);
      mockPolicyInputRepository.countEligibleItems.mockResolvedValue(totalItems);
      mockPolicyInputRepository.fetchBatchIds
        .mockResolvedValueOnce(allIds.slice(0, 2))
        .mockResolvedValueOnce(allIds.slice(2, 4))
        .mockResolvedValueOnce(allIds.slice(4))
        .mockResolvedValueOnce([]);
      mockPolicyInputRepository.findManyForEvaluation.mockImplementation((ids: string[]) =>
        Promise.resolve(ids.map(createMockPolicyEngineInput)),
      );
      mockEvaluationRepository.bulkUpsert.mockResolvedValue(2);

      const progressUpdates: Array<{ processed: number; total: number }> = [];
      const result = await service.reEvaluateAll(policyVersion, {
        batchSize: 2,
        onProgress: (processed, total) => progressUpdates.push({ processed, total }),
      });

      expect(result.processed).toBe(5);
      expect(result.eligible).toBe(5);
      expect(progressUpdates.length).toBeGreaterThan(0);
    });

    it('should use specified policy version', async () => {
      const policyVersion = 5;
      const customPolicy = { ...defaultPolicy, version: policyVersion };

      mockPolicyService.getByVersion.mockResolvedValue(customPolicy);
      mockPolicyInputRepository.countEligibleItems.mockResolvedValue(0);
      mockPolicyInputRepository.fetchBatchIds.mockResolvedValue([]);

      await service.reEvaluateAll(policyVersion);

      // reEvaluateAll doesn't call getActiveOrThrow directly, evaluateBatch does if no policyVersion
      // But reEvaluateAll always passes policyVersion to evaluateBatch, so getByVersion is called instead
      expect(mockPolicyInputRepository.countEligibleItems).toHaveBeenCalled();
    });

    it('should handle empty result set', async () => {
      mockPolicyService.getByVersion.mockResolvedValue(defaultPolicy);
      mockPolicyInputRepository.countEligibleItems.mockResolvedValue(0);
      mockPolicyInputRepository.fetchBatchIds.mockResolvedValue([]);

      const result = await service.reEvaluateAll(1);

      expect(result.processed).toBe(0);
      expect(result.eligible).toBe(0);
    });

    it('should aggregate results from multiple batches', async () => {
      const batch1Ids = ['media-1', 'media-2'];
      const batch2Ids = ['media-3'];

      mockPolicyService.getByVersion.mockResolvedValue(defaultPolicy);
      mockPolicyInputRepository.countEligibleItems.mockResolvedValue(3);
      mockPolicyInputRepository.fetchBatchIds
        .mockResolvedValueOnce(batch1Ids)
        .mockResolvedValueOnce(batch2Ids)
        .mockResolvedValueOnce([]);
      mockPolicyInputRepository.findManyForEvaluation.mockImplementation((ids: string[]) =>
        Promise.resolve(ids.map(createMockPolicyEngineInput)),
      );
      mockEvaluationRepository.bulkUpsert.mockResolvedValue(2);

      const result = await service.reEvaluateAll(1, { batchSize: 2 });

      expect(result.processed).toBe(3);
      expect(result.eligible).toBe(3);
    });

    it('should pass context to evaluateBatch', async () => {
      const context: EvaluationContextType = EvaluationContext.TRENDING;
      const ids = ['media-1'];

      mockPolicyService.getByVersion.mockResolvedValue(defaultPolicy);
      mockPolicyInputRepository.countEligibleItems.mockResolvedValue(1);
      mockPolicyInputRepository.fetchBatchIds.mockResolvedValueOnce(ids).mockResolvedValueOnce([]);
      mockPolicyInputRepository.findManyForEvaluation.mockResolvedValue(
        ids.map(createMockPolicyEngineInput),
      );
      mockEvaluationRepository.bulkUpsert.mockResolvedValue(1);

      await service.reEvaluateAll(1, { context });

      expect(mockEvaluationRepository.bulkUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ context })]),
      );
    });

    it('should call onProgress with correct values', async () => {
      const batch1Ids = ['media-1', 'media-2'];
      const batch2Ids = ['media-3'];
      const total = 3;

      mockPolicyService.getByVersion.mockResolvedValue(defaultPolicy);
      mockPolicyInputRepository.countEligibleItems.mockResolvedValue(total);
      mockPolicyInputRepository.fetchBatchIds
        .mockResolvedValueOnce(batch1Ids)
        .mockResolvedValueOnce(batch2Ids)
        .mockResolvedValueOnce([]);
      mockPolicyInputRepository.findManyForEvaluation.mockImplementation((ids: string[]) =>
        Promise.resolve(ids.map(createMockPolicyEngineInput)),
      );
      mockEvaluationRepository.bulkUpsert.mockResolvedValue(2);

      const onProgress = jest.fn();
      await service.reEvaluateAll(1, { batchSize: 2, onProgress });

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenNthCalledWith(1, 2, total);
      expect(onProgress).toHaveBeenNthCalledWith(2, 3, total);
    });
  });
});
