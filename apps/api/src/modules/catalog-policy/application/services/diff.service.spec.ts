/**
 * Diff Service Tests
 *
 * Unit tests for computing differences between policy versions.
 *
 * Feature: policy-activation-flow
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import {
  DIFF_REPOSITORY,
  CATALOG_EVALUATION_RUN_REPOSITORY,
  CATALOG_POLICY_REPOSITORY,
} from '../../domain/repositories';
import { EligibilityStatus, DIFF_STATUS_NONE } from '../../domain/constants/evaluation.constants';
import { DiffService, isDiffRegression, isDiffImprovement } from './diff.service';

describe('DiffService', () => {
  let service: DiffService;
  let mockRunRepository: any;
  let mockPolicyRepository: any;
  let mockDiffRepository: any;

  beforeEach(async () => {
    mockRunRepository = {
      findById: jest.fn(),
    };

    mockPolicyRepository = {
      findActive: jest.fn(),
    };

    mockDiffRepository = {
      computeDiffCounts: jest.fn(),
      getDiffSamples: jest.fn(),
      computeReasonBreakdown: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiffService,
        { provide: DIFF_REPOSITORY, useValue: mockDiffRepository },
        { provide: CATALOG_EVALUATION_RUN_REPOSITORY, useValue: mockRunRepository },
        { provide: CATALOG_POLICY_REPOSITORY, useValue: mockPolicyRepository },
      ],
    }).compile();

    service = module.get<DiffService>(DiffService);
  });

  describe('helper functions', () => {
    describe('isDiffRegression', () => {
      it('should return true when eligible becomes ineligible', () => {
        expect(isDiffRegression(EligibilityStatus.ELIGIBLE, EligibilityStatus.INELIGIBLE)).toBe(
          true,
        );
      });

      it('should return true when eligible becomes none (removed)', () => {
        expect(isDiffRegression(EligibilityStatus.ELIGIBLE, DIFF_STATUS_NONE)).toBe(true);
      });

      it('should return false when eligible stays eligible', () => {
        expect(isDiffRegression(EligibilityStatus.ELIGIBLE, EligibilityStatus.ELIGIBLE)).toBe(
          false,
        );
      });

      it('should return false when ineligible becomes eligible', () => {
        expect(isDiffRegression(EligibilityStatus.INELIGIBLE, EligibilityStatus.ELIGIBLE)).toBe(
          false,
        );
      });

      it('should return false when none becomes eligible', () => {
        expect(isDiffRegression(DIFF_STATUS_NONE, EligibilityStatus.ELIGIBLE)).toBe(false);
      });
    });

    describe('isDiffImprovement', () => {
      it('should return true when ineligible becomes eligible', () => {
        expect(isDiffImprovement(EligibilityStatus.INELIGIBLE, EligibilityStatus.ELIGIBLE)).toBe(
          true,
        );
      });

      it('should return true when none becomes eligible (new item)', () => {
        expect(isDiffImprovement(DIFF_STATUS_NONE, EligibilityStatus.ELIGIBLE)).toBe(true);
      });

      it('should return false when eligible stays eligible', () => {
        expect(isDiffImprovement(EligibilityStatus.ELIGIBLE, EligibilityStatus.ELIGIBLE)).toBe(
          false,
        );
      });

      it('should return false when eligible becomes ineligible', () => {
        expect(isDiffImprovement(EligibilityStatus.ELIGIBLE, EligibilityStatus.INELIGIBLE)).toBe(
          false,
        );
      });

      it('should return false when ineligible stays ineligible', () => {
        expect(isDiffImprovement(EligibilityStatus.INELIGIBLE, EligibilityStatus.INELIGIBLE)).toBe(
          false,
        );
      });
    });
  });

  describe('computeDiff', () => {
    it('should throw NotFoundException when run not found', async () => {
      mockRunRepository.findById.mockResolvedValue(null);

      await expect(service.computeDiff('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when run is not prepared or promoted', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'running',
        targetPolicyVersion: 2,
      });

      await expect(service.computeDiff('run-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when run has no target policy version', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'prepared',
        targetPolicyVersion: null,
        baselinePolicyVersion: 1,
      });

      await expect(service.computeDiff('run-1')).rejects.toThrow(BadRequestException);
      await expect(service.computeDiff('run-1')).rejects.toThrow(
        'Run has no target policy version',
      );
    });

    it('should allow diff for prepared status', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'prepared',
        targetPolicyVersion: 2,
        baselinePolicyVersion: 1,
      });

      mockDiffRepository.computeDiffCounts.mockResolvedValue({
        regressions: 0,
        improvements: 0,
        unchanged: 1,
        stillIneligible: 0,
      });
      mockDiffRepository.getDiffSamples.mockResolvedValue([]);
      mockDiffRepository.computeReasonBreakdown.mockResolvedValue({
        regressionReasons: {},
        improvementReasons: {},
      });

      const result = await service.computeDiff('run-1');

      expect(result.runId).toBe('run-1');
      expect(result.targetPolicyVersion).toBe(2);
      expect(result.currentPolicyVersion).toBe(1);
    });

    it('should allow diff for promoted status (uses baselinePolicyVersion)', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'promoted',
        targetPolicyVersion: 2,
        baselinePolicyVersion: 1,
      });

      mockDiffRepository.computeDiffCounts.mockResolvedValue({
        regressions: 0,
        improvements: 0,
        unchanged: 0,
        stillIneligible: 0,
      });
      mockDiffRepository.getDiffSamples.mockResolvedValue([]);
      mockDiffRepository.computeReasonBreakdown.mockResolvedValue({
        regressionReasons: {},
        improvementReasons: {},
      });

      const result = await service.computeDiff('run-1');

      expect(result.runId).toBe('run-1');
      expect(result.currentPolicyVersion).toBe(1);
    });

    it('should handle no baseline policy (first policy)', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'prepared',
        targetPolicyVersion: 1,
        baselinePolicyVersion: null,
      });
      mockPolicyRepository.findActive.mockResolvedValue(null);

      mockDiffRepository.computeDiffCounts.mockResolvedValue({
        regressions: 0,
        improvements: 800,
        unchanged: 0,
        stillIneligible: 200,
      });
      mockDiffRepository.getDiffSamples.mockResolvedValue([]);
      mockDiffRepository.computeReasonBreakdown.mockResolvedValue({
        regressionReasons: {},
        improvementReasons: {},
      });

      const result = await service.computeDiff('run-1');

      expect(result.currentPolicyVersion).toBeNull();
      expect(result.counts.regressions).toBe(0);
      expect(result.counts.improvements).toBe(800);
    });

    it('should fallback to active policy when baselinePolicyVersion is null', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'prepared',
        targetPolicyVersion: 2,
        baselinePolicyVersion: null,
      });
      mockPolicyRepository.findActive.mockResolvedValue({ version: 1 });

      mockDiffRepository.computeDiffCounts.mockResolvedValue({
        regressions: 5,
        improvements: 10,
        unchanged: 100,
        stillIneligible: 50,
      });
      mockDiffRepository.getDiffSamples.mockResolvedValue([]);
      mockDiffRepository.computeReasonBreakdown.mockResolvedValue({
        regressionReasons: {},
        improvementReasons: {},
      });

      const result = await service.computeDiff('run-1');

      expect(mockPolicyRepository.findActive).toHaveBeenCalled();
      expect(result.currentPolicyVersion).toBe(1);
      expect(mockDiffRepository.computeDiffCounts).toHaveBeenCalledWith(2, 1);
    });

    it('should return counts from repository', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'prepared',
        targetPolicyVersion: 2,
        baselinePolicyVersion: 1,
      });

      mockDiffRepository.computeDiffCounts.mockResolvedValue({
        regressions: 2,
        improvements: 1,
        unchanged: 1,
        stillIneligible: 1,
      });
      mockDiffRepository.getDiffSamples.mockResolvedValue([]);
      mockDiffRepository.computeReasonBreakdown.mockResolvedValue({
        regressionReasons: {},
        improvementReasons: {},
      });

      const result = await service.computeDiff('run-1');

      expect(result.counts).toEqual({
        regressions: 2,
        improvements: 1,
        unchanged: 1,
        stillIneligible: 1,
      });
    });

    it('should return sample items', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'prepared',
        targetPolicyVersion: 2,
        baselinePolicyVersion: 1,
      });

      mockDiffRepository.computeDiffCounts.mockResolvedValue({
        regressions: 1,
        improvements: 1,
        unchanged: 0,
        stillIneligible: 0,
      });
      mockDiffRepository.getDiffSamples
        .mockResolvedValueOnce([
          {
            mediaItemId: 'item-1',
            title: 'Movie 1',
            oldStatus: 'eligible',
            newStatus: 'ineligible',
            trendingScore: 95,
          },
        ])
        .mockResolvedValueOnce([
          {
            mediaItemId: 'item-2',
            title: 'Movie 2',
            oldStatus: 'ineligible',
            newStatus: 'eligible',
            trendingScore: 88,
          },
        ]);
      mockDiffRepository.computeReasonBreakdown.mockResolvedValue({
        regressionReasons: { BLOCKED_COUNTRY: 1 },
        improvementReasons: { ALLOWED_COUNTRY: 1 },
      });

      const result = await service.computeDiff('run-1');

      expect(result.topRegressions).toHaveLength(1);
      expect(result.topRegressions[0].mediaItemId).toBe('item-1');
      expect(result.topImprovements).toHaveLength(1);
      expect(result.topImprovements[0].mediaItemId).toBe('item-2');
    });

    it('should respect sampleSize parameter', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'prepared',
        targetPolicyVersion: 2,
        baselinePolicyVersion: 1,
      });

      mockDiffRepository.computeDiffCounts.mockResolvedValue({
        regressions: 0,
        improvements: 0,
        unchanged: 0,
        stillIneligible: 0,
      });
      mockDiffRepository.getDiffSamples.mockResolvedValue([]);
      mockDiffRepository.computeReasonBreakdown.mockResolvedValue({
        regressionReasons: {},
        improvementReasons: {},
      });

      await service.computeDiff('run-1', 10);

      // Verify getDiffSamples was called with the correct limit
      expect(mockDiffRepository.getDiffSamples).toHaveBeenCalledWith(2, 1, 'regression', 10);
      expect(mockDiffRepository.getDiffSamples).toHaveBeenCalledWith(2, 1, 'improvement', 10);
    });

    it('should use default sampleSize of 50 when not specified', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'prepared',
        targetPolicyVersion: 2,
        baselinePolicyVersion: 1,
      });

      mockDiffRepository.computeDiffCounts.mockResolvedValue({
        regressions: 0,
        improvements: 0,
        unchanged: 0,
        stillIneligible: 0,
      });
      mockDiffRepository.getDiffSamples.mockResolvedValue([]);
      mockDiffRepository.computeReasonBreakdown.mockResolvedValue({
        regressionReasons: {},
        improvementReasons: {},
      });

      await service.computeDiff('run-1');

      expect(mockDiffRepository.getDiffSamples).toHaveBeenCalledWith(2, 1, 'regression', 50);
      expect(mockDiffRepository.getDiffSamples).toHaveBeenCalledWith(2, 1, 'improvement', 50);
    });

    it('should include reasonBreakdown in result', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'prepared',
        targetPolicyVersion: 2,
        baselinePolicyVersion: 1,
      });

      mockDiffRepository.computeDiffCounts.mockResolvedValue({
        regressions: 2,
        improvements: 3,
        unchanged: 10,
        stillIneligible: 5,
      });
      mockDiffRepository.getDiffSamples.mockResolvedValue([]);
      mockDiffRepository.computeReasonBreakdown.mockResolvedValue({
        regressionReasons: { BLOCKED_COUNTRY: 2 },
        improvementReasons: { ALLOWED_LANGUAGE: 3 },
      });

      const result = await service.computeDiff('run-1');

      expect(result.reasonBreakdown).toEqual({
        regressionReasons: { BLOCKED_COUNTRY: 2 },
        improvementReasons: { ALLOWED_LANGUAGE: 3 },
      });
    });

    it('should call repository methods in parallel', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'prepared',
        targetPolicyVersion: 2,
        baselinePolicyVersion: 1,
      });

      // Track call order
      const callOrder: string[] = [];
      mockDiffRepository.computeDiffCounts.mockImplementation(async () => {
        callOrder.push('computeDiffCounts');
        return { regressions: 0, improvements: 0, unchanged: 0, stillIneligible: 0 };
      });
      mockDiffRepository.getDiffSamples.mockImplementation(
        async (_target: number, _baseline: number, type: string) => {
          callOrder.push(`getDiffSamples:${type}`);
          return [];
        },
      );
      mockDiffRepository.computeReasonBreakdown.mockImplementation(async () => {
        callOrder.push('computeReasonBreakdown');
        return { regressionReasons: {}, improvementReasons: {} };
      });

      await service.computeDiff('run-1');

      // Verify all methods were called
      expect(callOrder).toContain('computeDiffCounts');
      expect(callOrder).toContain('getDiffSamples:regression');
      expect(callOrder).toContain('getDiffSamples:improvement');
      expect(callOrder).toContain('computeReasonBreakdown');
    });
  });
});
