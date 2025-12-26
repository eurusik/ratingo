/**
 * Diff Service Tests
 *
 * Unit tests for computing differences between policy versions.
 *
 * Feature: policy-activation-flow
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DiffService, isDiffRegression, isDiffImprovement } from './diff.service';
import { CATALOG_EVALUATION_RUN_REPOSITORY } from '../../infrastructure/repositories/catalog-evaluation-run.repository';
import { CATALOG_POLICY_REPOSITORY } from '../../infrastructure/repositories/catalog-policy.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { EligibilityStatus, DIFF_STATUS_NONE } from '../../domain/constants/evaluation.constants';

describe('DiffService', () => {
  let service: DiffService;
  let mockRunRepository: any;
  let mockPolicyRepository: any;
  let mockDb: any;
  let whereResults: any[];
  let executeResult: any;

  beforeEach(async () => {
    mockRunRepository = {
      findById: jest.fn(),
    };

    mockPolicyRepository = {
      findActive: jest.fn(),
    };

    // Track which query is being made to return appropriate results
    whereResults = [];
    let whereCallIndex = 0;
    executeResult = [
      { regressions: '0', improvements: '0', unchanged: '0', still_ineligible: '0' },
    ];

    // Create a chainable mock that supports all query builder methods
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockImplementation(() => {
        const result = whereResults[whereCallIndex] ?? [];
        whereCallIndex++;
        return Promise.resolve(result);
      }),
      limit: jest.fn().mockResolvedValue([]),
      execute: jest.fn().mockImplementation(() => Promise.resolve(executeResult)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiffService,
        { provide: CATALOG_EVALUATION_RUN_REPOSITORY, useValue: mockRunRepository },
        { provide: CATALOG_POLICY_REPOSITORY, useValue: mockPolicyRepository },
        { provide: DATABASE_CONNECTION, useValue: mockDb },
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

      it('should return true when eligible becomes pending', () => {
        expect(isDiffRegression(EligibilityStatus.ELIGIBLE, EligibilityStatus.PENDING)).toBe(true);
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

      it('should return true when pending becomes eligible', () => {
        expect(isDiffImprovement(EligibilityStatus.PENDING, EligibilityStatus.ELIGIBLE)).toBe(true);
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

    it('should allow diff for prepared status', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'prepared',
        targetPolicyVersion: 2,
      });
      mockPolicyRepository.findActive.mockResolvedValue({
        id: 'policy-1',
        version: 1,
      });

      // SQL aggregation result
      executeResult = [
        { regressions: '0', improvements: '0', unchanged: '1', still_ineligible: '0' },
      ];

      // Query sequence for getSampleItems:
      // 1. Old evals for getSampleItems (regressions)
      // 2. New evals with join for getSampleItems (regressions)
      // 3. Old evals for getSampleItems (improvements)
      // 4. New evals with join for getSampleItems (improvements)
      whereResults = [
        [{ mediaItemId: 'item-1', status: 'eligible' }], // old evals for regressions
        [{ mediaItemId: 'item-1', status: 'eligible', title: 'Movie 1', trendingScore: 100 }], // new evals with join
        [{ mediaItemId: 'item-1', status: 'eligible' }], // old evals for improvements
        [{ mediaItemId: 'item-1', status: 'eligible', title: 'Movie 1', trendingScore: 100 }], // new evals with join
      ];

      const result = await service.computeDiff('run-1');

      expect(result.runId).toBe('run-1');
      expect(result.targetPolicyVersion).toBe(2);
      expect(result.currentPolicyVersion).toBe(1);
    });

    it('should allow diff for promoted status', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'promoted',
        targetPolicyVersion: 2,
      });
      mockPolicyRepository.findActive.mockResolvedValue({
        id: 'policy-1',
        version: 2,
      });

      executeResult = [
        { regressions: '0', improvements: '0', unchanged: '0', still_ineligible: '0' },
      ];

      whereResults = [
        [], // old evals for regressions
        [], // new evals with join
        [], // old evals for improvements
        [], // new evals with join
      ];

      const result = await service.computeDiff('run-1');

      expect(result.runId).toBe('run-1');
    });

    it('should handle no active policy (first policy)', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'prepared',
        targetPolicyVersion: 1,
      });
      mockPolicyRepository.findActive.mockResolvedValue(null);

      // When no current policy, SQL aggregation handles it with FALSE filter
      executeResult = [
        { regressions: '0', improvements: '800', unchanged: '0', still_ineligible: '200' },
      ];

      whereResults = [
        [], // old evals for regressions (empty - no current policy)
        [{ mediaItemId: 'item-1', status: 'eligible', title: 'Movie 1', trendingScore: 100 }], // new evals
        [], // old evals for improvements
        [{ mediaItemId: 'item-1', status: 'eligible', title: 'Movie 1', trendingScore: 100 }], // new evals
      ];

      const result = await service.computeDiff('run-1');

      expect(result.currentPolicyVersion).toBeNull();
      expect(result.counts.regressions).toBe(0);
      expect(result.counts.improvements).toBe(800);
    });

    it('should return counts from database', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'prepared',
        targetPolicyVersion: 2,
      });
      mockPolicyRepository.findActive.mockResolvedValue({
        id: 'policy-1',
        version: 1,
      });

      // SQL aggregation result: 2 regressions, 1 improvement, 1 unchanged, 1 stillIneligible
      executeResult = [
        { regressions: '2', improvements: '1', unchanged: '1', still_ineligible: '1' },
      ];

      whereResults = [
        // Old evals for getSampleItems (regressions)
        [
          { mediaItemId: 'item-1', status: 'eligible' },
          { mediaItemId: 'item-2', status: 'eligible' },
          { mediaItemId: 'item-3', status: 'ineligible' },
          { mediaItemId: 'item-4', status: 'eligible' },
          { mediaItemId: 'item-5', status: 'ineligible' },
        ],
        // New evals with join for getSampleItems (regressions)
        [
          { mediaItemId: 'item-1', status: 'ineligible', title: 'Movie 1', trendingScore: 100 },
          { mediaItemId: 'item-2', status: 'ineligible', title: 'Movie 2', trendingScore: 90 },
          { mediaItemId: 'item-3', status: 'eligible', title: 'Movie 3', trendingScore: 80 },
          { mediaItemId: 'item-4', status: 'eligible', title: 'Movie 4', trendingScore: 70 },
          { mediaItemId: 'item-5', status: 'ineligible', title: 'Movie 5', trendingScore: 60 },
        ],
        // Old evals for getSampleItems (improvements)
        [
          { mediaItemId: 'item-1', status: 'eligible' },
          { mediaItemId: 'item-2', status: 'eligible' },
          { mediaItemId: 'item-3', status: 'ineligible' },
          { mediaItemId: 'item-4', status: 'eligible' },
          { mediaItemId: 'item-5', status: 'ineligible' },
        ],
        // New evals with join for getSampleItems (improvements)
        [
          { mediaItemId: 'item-1', status: 'ineligible', title: 'Movie 1', trendingScore: 100 },
          { mediaItemId: 'item-2', status: 'ineligible', title: 'Movie 2', trendingScore: 90 },
          { mediaItemId: 'item-3', status: 'eligible', title: 'Movie 3', trendingScore: 80 },
          { mediaItemId: 'item-4', status: 'eligible', title: 'Movie 4', trendingScore: 70 },
          { mediaItemId: 'item-5', status: 'ineligible', title: 'Movie 5', trendingScore: 60 },
        ],
      ];

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
      });
      mockPolicyRepository.findActive.mockResolvedValue({
        id: 'policy-1',
        version: 1,
      });

      executeResult = [
        { regressions: '1', improvements: '1', unchanged: '0', still_ineligible: '0' },
      ];

      whereResults = [
        // Old evals for getSampleItems (regressions)
        [
          { mediaItemId: 'item-1', status: 'eligible' },
          { mediaItemId: 'item-2', status: 'ineligible' },
        ],
        // New evals with join for getSampleItems (regressions)
        [
          { mediaItemId: 'item-1', status: 'ineligible', title: 'Movie 1', trendingScore: 95 },
          { mediaItemId: 'item-2', status: 'eligible', title: 'Movie 2', trendingScore: 88 },
        ],
        // Old evals for getSampleItems (improvements)
        [
          { mediaItemId: 'item-1', status: 'eligible' },
          { mediaItemId: 'item-2', status: 'ineligible' },
        ],
        // New evals with join for getSampleItems (improvements)
        [
          { mediaItemId: 'item-1', status: 'ineligible', title: 'Movie 1', trendingScore: 95 },
          { mediaItemId: 'item-2', status: 'eligible', title: 'Movie 2', trendingScore: 88 },
        ],
      ];

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
      });
      mockPolicyRepository.findActive.mockResolvedValue({
        id: 'policy-1',
        version: 1,
      });

      executeResult = [
        { regressions: '0', improvements: '0', unchanged: '0', still_ineligible: '0' },
      ];

      whereResults = [
        [], // old evals for regressions
        [], // new evals with join
        [], // old evals for improvements
        [], // new evals with join
      ];

      await service.computeDiff('run-1', 10);

      // Verify db.execute was called for SQL aggregation
      expect(mockDb.execute).toHaveBeenCalled();
      // Verify db.select was called for sample retrieval
      expect(mockDb.select).toHaveBeenCalled();
    });
  });
});
