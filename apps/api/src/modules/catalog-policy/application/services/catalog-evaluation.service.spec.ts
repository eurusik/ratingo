/**
 * CatalogEvaluationService Unit Tests
 *
 * Tests the catalog evaluation service with mocked dependencies.
 */

import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import {
  EligibilityStatus,
  EvaluationContext,
  EvaluationReason,
  type EvaluationContextType,
} from '../../domain/constants/evaluation.constants';
import { POLICY_INPUT_REPOSITORY } from '../../domain/repositories/policy-input.repository.interface';
import type { PolicyEngineInput, PolicyConfig } from '../../domain/types/policy.types';
import { MEDIA_CATALOG_EVALUATION_REPOSITORY } from '../../infrastructure/repositories/media-catalog-evaluation.repository';

import { CatalogEvaluationService } from './catalog-evaluation.service';
import { CatalogPolicyService } from './catalog-policy.service';

describe('CatalogEvaluationService', () => {
  let service: CatalogEvaluationService;
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
    findByMediaIdForContexts: jest.Mock;
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

  const createMockPolicyEngineInput = (
    overrides?: Partial<PolicyEngineInput>,
  ): PolicyEngineInput => ({
    mediaItem: {
      id: 'test-media-1',
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
    ...overrides,
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
      findByMediaIdForContexts: jest.fn(),
      upsert: jest.fn(),
      bulkUpsert: jest.fn(),
      countByStatusAndPolicyVersion: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogEvaluationService,
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

    service = moduleRef.get<CatalogEvaluationService>(CatalogEvaluationService);
  });

  describe('evaluateOne', () => {
    it('should evaluate media item with default context', async () => {
      const mediaItemId = 'test-media-1';
      const engineInput = createMockPolicyEngineInput();

      mockPolicyInputRepository.findOneForEvaluation.mockResolvedValue(engineInput);
      mockEvaluationRepository.findByMediaId.mockResolvedValue(null);
      mockEvaluationRepository.upsert.mockImplementation((evaluation) =>
        Promise.resolve(evaluation),
      );

      const result = await service.evaluateOne({ mediaItemId });

      expect(result.mediaItemId).toBe(mediaItemId);
      expect(result.evaluation.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.changed).toBe(true);
      expect(mockPolicyInputRepository.findOneForEvaluation).toHaveBeenCalledWith(mediaItemId);
    });

    it('should use specified policy version', async () => {
      const mediaItemId = 'test-media-1';
      const policyVersion = 5;
      const engineInput = createMockPolicyEngineInput();
      const customPolicy = { ...defaultPolicy, version: policyVersion };

      mockPolicyService.getByVersion.mockResolvedValue(customPolicy);
      mockPolicyInputRepository.findOneForEvaluation.mockResolvedValue(engineInput);
      mockEvaluationRepository.findByMediaId.mockResolvedValue(null);
      mockEvaluationRepository.upsert.mockImplementation((evaluation) =>
        Promise.resolve(evaluation),
      );

      const result = await service.evaluateOne({ mediaItemId, policyVersion });

      expect(result.evaluation.policyVersion).toBe(policyVersion);
      expect(mockPolicyService.getByVersion).toHaveBeenCalledWith(policyVersion);
    });

    it('should throw NotFoundException when media item not found', async () => {
      const mediaItemId = 'non-existent';

      mockPolicyInputRepository.findOneForEvaluation.mockResolvedValue(null);

      await expect(service.evaluateOne({ mediaItemId })).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when policy version not found', async () => {
      const mediaItemId = 'test-media-1';
      const policyVersion = 999;

      mockPolicyService.getByVersion.mockResolvedValue(null);

      await expect(service.evaluateOne({ mediaItemId, policyVersion })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should detect status change from previous evaluation', async () => {
      const mediaItemId = 'test-media-1';
      const engineInput = createMockPolicyEngineInput();
      const previousEvaluation = {
        mediaItemId,
        status: EligibilityStatus.INELIGIBLE,
        policyVersion: 1,
      };

      mockPolicyInputRepository.findOneForEvaluation.mockResolvedValue(engineInput);
      mockEvaluationRepository.findByMediaId.mockResolvedValue(previousEvaluation);
      mockEvaluationRepository.upsert.mockImplementation((evaluation) =>
        Promise.resolve(evaluation),
      );

      const result = await service.evaluateOne({ mediaItemId });

      expect(result.changed).toBe(true);
    });

    it('should detect no change when status is same', async () => {
      const mediaItemId = 'test-media-1';
      const engineInput = createMockPolicyEngineInput();
      const previousEvaluation = {
        mediaItemId,
        status: EligibilityStatus.ELIGIBLE,
        policyVersion: 1,
      };

      mockPolicyInputRepository.findOneForEvaluation.mockResolvedValue(engineInput);
      mockEvaluationRepository.findByMediaId.mockResolvedValue(previousEvaluation);
      mockEvaluationRepository.upsert.mockImplementation((evaluation) =>
        Promise.resolve(evaluation),
      );

      const result = await service.evaluateOne({ mediaItemId });

      expect(result.changed).toBe(false);
    });

    it('should pass context to evaluation repository', async () => {
      const mediaItemId = 'test-media-1';
      const context: EvaluationContextType = EvaluationContext.TRENDING;
      const engineInput = createMockPolicyEngineInput();

      mockPolicyInputRepository.findOneForEvaluation.mockResolvedValue(engineInput);
      mockEvaluationRepository.findByMediaId.mockResolvedValue(null);
      mockEvaluationRepository.upsert.mockImplementation((evaluation) =>
        Promise.resolve(evaluation),
      );

      await service.evaluateOne({ mediaItemId, context });

      expect(mockEvaluationRepository.findByMediaId).toHaveBeenCalledWith(mediaItemId, context);
      expect(mockEvaluationRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ context }),
      );
    });

    it('should include runId in evaluation when provided', async () => {
      const mediaItemId = 'test-media-1';
      const runId = 'run-123';
      const engineInput = createMockPolicyEngineInput();

      mockPolicyInputRepository.findOneForEvaluation.mockResolvedValue(engineInput);
      mockEvaluationRepository.findByMediaId.mockResolvedValue(null);
      mockEvaluationRepository.upsert.mockImplementation((evaluation) =>
        Promise.resolve(evaluation),
      );

      await service.evaluateOne({ mediaItemId, runId });

      expect(mockEvaluationRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ runId }),
      );
    });
  });

  describe('evaluateOneForContexts', () => {
    it('should evaluate for multiple contexts with single batch fetch', async () => {
      const mediaItemId = 'test-media-1';
      const contexts: EvaluationContextType[] = [
        EvaluationContext.CATALOG,
        EvaluationContext.TRENDING,
      ];
      const engineInput = createMockPolicyEngineInput();

      mockPolicyInputRepository.findOneForEvaluation.mockResolvedValue(engineInput);
      mockEvaluationRepository.findByMediaIdForContexts.mockResolvedValue(new Map());
      mockEvaluationRepository.bulkUpsert.mockResolvedValue(contexts.length);

      await service.evaluateOneForContexts({ mediaItemId }, contexts);

      // Should fetch policy input once
      expect(mockPolicyInputRepository.findOneForEvaluation).toHaveBeenCalledTimes(1);
      // Should batch fetch previous evaluations (N+1 fix)
      expect(mockEvaluationRepository.findByMediaIdForContexts).toHaveBeenCalledWith(
        mediaItemId,
        contexts,
      );
      // Should NOT call individual findByMediaId (N+1 was fixed)
      expect(mockEvaluationRepository.findByMediaId).not.toHaveBeenCalled();
      // Should bulk upsert all evaluations
      expect(mockEvaluationRepository.bulkUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ context: EvaluationContext.CATALOG }),
          expect.objectContaining({ context: EvaluationContext.TRENDING }),
        ]),
      );
    });

    it('should detect changes using batch-fetched previous evaluations', async () => {
      const mediaItemId = 'test-media-1';
      const contexts: EvaluationContextType[] = [
        EvaluationContext.CATALOG,
        EvaluationContext.TRENDING,
      ];
      const engineInput = createMockPolicyEngineInput();

      // Mock previous evaluation for CATALOG context only
      const previousEvaluationsMap = new Map<EvaluationContextType, unknown>([
        [EvaluationContext.CATALOG, { status: EligibilityStatus.INELIGIBLE, policyVersion: 1 }],
      ]);

      mockPolicyInputRepository.findOneForEvaluation.mockResolvedValue(engineInput);
      mockEvaluationRepository.findByMediaIdForContexts.mockResolvedValue(previousEvaluationsMap);
      mockEvaluationRepository.bulkUpsert.mockResolvedValue(contexts.length);

      await service.evaluateOneForContexts({ mediaItemId }, contexts);

      expect(mockEvaluationRepository.findByMediaIdForContexts).toHaveBeenCalledWith(
        mediaItemId,
        contexts,
      );
    });

    it('should return early for empty contexts array', async () => {
      const mediaItemId = 'test-media-1';

      await service.evaluateOneForContexts({ mediaItemId }, []);

      expect(mockPolicyInputRepository.findOneForEvaluation).not.toHaveBeenCalled();
      expect(mockEvaluationRepository.findByMediaIdForContexts).not.toHaveBeenCalled();
      expect(mockEvaluationRepository.bulkUpsert).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when media item not found', async () => {
      const mediaItemId = 'non-existent';

      mockPolicyInputRepository.findOneForEvaluation.mockResolvedValue(null);

      await expect(
        service.evaluateOneForContexts({ mediaItemId }, [EvaluationContext.CATALOG]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEligibilityStats', () => {
    it('should return eligibility stats for context', async () => {
      const context: EvaluationContextType = EvaluationContext.CATALOG;
      const counts = { eligible: 100, ineligible: 50, review: 10 };

      mockEvaluationRepository.countByStatusAndPolicyVersion.mockResolvedValue(counts);

      const result = await service.getEligibilityStats(context);

      expect(result).toEqual({
        eligible: 100,
        ineligible: 50,
        review: 10,
        total: 160,
      });
      expect(mockEvaluationRepository.countByStatusAndPolicyVersion).toHaveBeenCalledWith(
        defaultPolicy.version,
        context,
      );
    });
  });
});
