/**
 * Run Controller Tests
 *
 * Unit tests for RunController endpoints:
 * - GET /admin/catalog-policies/runs
 * - GET /admin/catalog-policies/runs/:runId
 * - POST /admin/catalog-policies/runs/:runId/promote
 * - POST /admin/catalog-policies/runs/:runId/cancel
 * - GET /admin/catalog-policies/runs/:runId/diff
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RunController } from './run.controller';
import { PolicyActivationService } from '../../application/services/policy-activation.service';
import { DiffService } from '../../application/services/diff.service';
import { CATALOG_POLICY_REPOSITORY } from '../../infrastructure/repositories/catalog-policy.repository';
import { CATALOG_EVALUATION_RUN_REPOSITORY } from '../../infrastructure/repositories/catalog-evaluation-run.repository';

describe('RunController', () => {
  let controller: RunController;
  let mockPolicyActivationService: any;
  let mockDiffService: any;
  let mockPolicyRepository: any;
  let mockRunRepository: any;

  beforeEach(async () => {
    mockPolicyActivationService = {
      getRunStatus: jest.fn(),
      promoteRun: jest.fn(),
      cancelRun: jest.fn(),
    };

    mockDiffService = {
      computeDiff: jest.fn(),
    };

    mockPolicyRepository = {
      findAll: jest.fn(),
    };

    mockRunRepository = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RunController],
      providers: [
        { provide: PolicyActivationService, useValue: mockPolicyActivationService },
        { provide: DiffService, useValue: mockDiffService },
        { provide: CATALOG_POLICY_REPOSITORY, useValue: mockPolicyRepository },
        { provide: CATALOG_EVALUATION_RUN_REPOSITORY, useValue: mockRunRepository },
      ],
    }).compile();

    controller = module.get<RunController>(RunController);
  });

  describe('getRuns', () => {
    it('should return list of runs with policy names', async () => {
      const mockRuns = [
        {
          id: 'run-1',
          targetPolicyId: 'policy-1',
          policyVersion: 2,
          status: 'prepared',
          processed: 1000,
          totalReadySnapshot: 1000,
          eligible: 800,
          ineligible: 150,
          pending: 50,
          errors: 0,
          startedAt: new Date('2024-01-01'),
          finishedAt: new Date('2024-01-01'),
        },
      ];

      const mockPolicies = [{ id: 'policy-1', version: 2 }];

      mockRunRepository.findAll.mockResolvedValue(mockRuns);
      mockPolicyRepository.findAll.mockResolvedValue(mockPolicies);

      const result = await controller.getRuns('10', '0');

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'run-1',
        policyId: 'policy-1',
        policyName: 'Policy v2',
        status: 'prepared',
        readyToPromote: true,
      });
      expect(result.data[0].progress).toEqual({
        processed: 1000,
        total: 1000,
        eligible: 800,
        ineligible: 150,
        pending: 50,
        errors: 0,
      });
    });

    it('should use default pagination when not provided', async () => {
      mockRunRepository.findAll.mockResolvedValue([]);
      mockPolicyRepository.findAll.mockResolvedValue([]);

      await controller.getRuns(undefined, undefined);

      expect(mockRunRepository.findAll).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    });
  });

  describe('getRunStatus', () => {
    it('should return detailed run status', async () => {
      mockPolicyActivationService.getRunStatus.mockResolvedValue({
        id: 'run-1',
        targetPolicyId: 'policy-1',
        targetPolicyVersion: 2,
        status: 'prepared',
        processed: 1000,
        totalReadySnapshot: 1000,
        eligible: 800,
        ineligible: 150,
        pending: 50,
        errors: 0,
        startedAt: new Date('2024-01-01'),
        finishedAt: new Date('2024-01-01'),
        promotedAt: null,
        promotedBy: null,
        readyToPromote: true,
        blockingReasons: [],
        coverage: 1.0,
      });

      const result = await controller.getRunStatus('run-1');

      expect(result.id).toBe('run-1');
      expect(result.readyToPromote).toBe(true);
      expect(result.blockingReasons).toEqual([]);
      expect(result.coverage).toBe(1.0);
    });
  });

  describe('promoteRun', () => {
    it('should return success when promotion succeeds', async () => {
      mockPolicyActivationService.promoteRun.mockResolvedValue({ success: true });

      const result = await controller.promoteRun('run-1', {});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Policy activated successfully');
    });

    it('should return error when promotion fails', async () => {
      mockPolicyActivationService.promoteRun.mockResolvedValue({
        success: false,
        error: 'Coverage below threshold',
      });

      const result = await controller.promoteRun('run-1', { coverageThreshold: 1.0 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Coverage below threshold');
    });
  });

  describe('cancelRun', () => {
    it('should return success when cancellation succeeds', async () => {
      mockPolicyActivationService.cancelRun.mockResolvedValue({ success: true });

      const result = await controller.cancelRun('run-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Run cancelled successfully');
    });

    it('should return error when cancellation fails', async () => {
      mockPolicyActivationService.cancelRun.mockResolvedValue({
        success: false,
        error: 'Run already completed',
      });

      const result = await controller.cancelRun('run-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Run already completed');
    });
  });

  describe('getDiff', () => {
    it('should return diff report', async () => {
      mockDiffService.computeDiff.mockResolvedValue({
        runId: 'run-1',
        targetPolicyVersion: 2,
        currentPolicyVersion: 1,
        counts: {
          regressions: 10,
          improvements: 50,
          unchanged: 900,
          stillIneligible: 40,
        },
        topRegressions: [
          {
            mediaItemId: 'item-1',
            title: 'Movie 1',
            oldStatus: 'eligible',
            newStatus: 'ineligible',
          },
        ],
        topImprovements: [
          {
            mediaItemId: 'item-2',
            title: 'Movie 2',
            oldStatus: 'ineligible',
            newStatus: 'eligible',
          },
        ],
      });

      const result = await controller.getDiff('run-1', '10');

      expect(result.runId).toBe('run-1');
      expect(result.counts.regressions).toBe(10);
      expect(result.counts.improvements).toBe(50);
      expect(result.counts.netChange).toBe(40); // 50 - 10
      expect(result.topRegressions).toHaveLength(1);
      expect(result.topImprovements).toHaveLength(1);
    });

    it('should use default sample size when not provided', async () => {
      mockDiffService.computeDiff.mockResolvedValue({
        runId: 'run-1',
        targetPolicyVersion: 2,
        currentPolicyVersion: 1,
        counts: { regressions: 0, improvements: 0, unchanged: 0, stillIneligible: 0 },
        topRegressions: [],
        topImprovements: [],
      });

      await controller.getDiff('run-1', undefined);

      expect(mockDiffService.computeDiff).toHaveBeenCalledWith('run-1', 50);
    });
  });
});
