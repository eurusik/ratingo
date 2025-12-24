/**
 * Policy Activation Service Tests
 *
 * Unit tests for the two-phase policy activation flow (Prepare → Promote).
 * Tests cover core business logic without database dependencies.
 *
 * Feature: policy-activation-flow
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PolicyActivationService, RunStatus, BlockingReason } from './policy-activation.service';
import { CATALOG_POLICY_REPOSITORY } from '../../infrastructure/repositories/catalog-policy.repository';
import { CATALOG_EVALUATION_RUN_REPOSITORY } from '../../infrastructure/repositories/catalog-evaluation-run.repository';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { CATALOG_POLICY_QUEUE } from '../../catalog-policy.constants';
import { getQueueToken } from '@nestjs/bullmq';

describe('PolicyActivationService', () => {
  let service: PolicyActivationService;
  let mockPolicyRepository: any;
  let mockRunRepository: any;
  let mockQueue: any;
  let mockDb: any;

  beforeEach(async () => {
    mockPolicyRepository = {
      findById: jest.fn(),
      activate: jest.fn(),
    };

    mockRunRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPolicyId: jest.fn(),
      update: jest.fn(),
      incrementCounters: jest.fn(),
      recordError: jest.fn(),
    };

    mockQueue = {
      add: jest.fn(),
    };

    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([{ count: 1000 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyActivationService,
        { provide: CATALOG_POLICY_REPOSITORY, useValue: mockPolicyRepository },
        { provide: CATALOG_EVALUATION_RUN_REPOSITORY, useValue: mockRunRepository },
        { provide: DATABASE_CONNECTION, useValue: mockDb },
        { provide: getQueueToken(CATALOG_POLICY_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<PolicyActivationService>(PolicyActivationService);
  });

  describe('preparePolicy', () => {
    it('should throw NotFoundException when policy does not exist', async () => {
      mockPolicyRepository.findById.mockResolvedValue(null);

      await expect(service.preparePolicy('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when policy is already active', async () => {
      mockPolicyRepository.findById.mockResolvedValue({
        id: 'policy-1',
        version: 2,
        isActive: true,
      });

      await expect(service.preparePolicy('policy-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when a run is already in progress', async () => {
      mockPolicyRepository.findById.mockResolvedValue({
        id: 'policy-1',
        version: 2,
        isActive: false,
      });
      mockRunRepository.findByPolicyId.mockResolvedValue([{ id: 'run-1', status: 'running' }]);

      await expect(service.preparePolicy('policy-1')).rejects.toThrow(BadRequestException);
    });

    it('should create run and queue job when policy is valid', async () => {
      mockPolicyRepository.findById.mockResolvedValue({
        id: 'policy-1',
        version: 2,
        isActive: false,
      });
      mockRunRepository.findByPolicyId.mockResolvedValue([]);
      mockRunRepository.create.mockResolvedValue({
        id: 'run-123',
        status: 'running',
      });

      const result = await service.preparePolicy('policy-1');

      expect(result.runId).toBe('run-123');
      expect(result.status).toBe('running');
      expect(mockRunRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          targetPolicyId: 'policy-1',
          targetPolicyVersion: 2,
        }),
      );
      expect(mockQueue.add).toHaveBeenCalled();
    });
  });

  describe('getRunStatus', () => {
    it('should throw NotFoundException when run does not exist', async () => {
      mockRunRepository.findById.mockResolvedValue(null);

      await expect(service.getRunStatus('non-existent-run')).rejects.toThrow(NotFoundException);
    });

    it('should calculate coverage correctly', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        targetPolicyId: 'policy-1',
        targetPolicyVersion: 2,
        status: 'running',
        totalReadySnapshot: 1000,
        processed: 500,
        eligible: 400,
        ineligible: 80,
        pending: 20,
        errors: 0,
        startedAt: new Date(),
        finishedAt: null,
        promotedAt: null,
        promotedBy: null,
      });

      const result = await service.getRunStatus('run-1');

      expect(result.coverage).toBe(0.5);
      expect(result.processed).toBe(500);
    });

    it('should return coverage 0 when totalReadySnapshot is 0', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        targetPolicyId: 'policy-1',
        targetPolicyVersion: 2,
        status: 'success',
        totalReadySnapshot: 0,
        processed: 0,
        eligible: 0,
        ineligible: 0,
        pending: 0,
        errors: 0,
        startedAt: new Date(),
        finishedAt: new Date(),
        promotedAt: null,
        promotedBy: null,
      });

      const result = await service.getRunStatus('run-1');

      expect(result.coverage).toBe(0);
    });
  });

  describe('readyToPromote flag', () => {
    /**
     * Property 12: Ready To Promote Flag
     *
     * readyToPromote = status=SUCCESS AND coverage >= threshold AND errors <= max
     *
     * Validates: Requirements 3.9
     */
    it('should be true only when status=success, coverage=100%, errors=0', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        targetPolicyId: 'policy-1',
        targetPolicyVersion: 2,
        status: 'success',
        totalReadySnapshot: 1000,
        processed: 1000,
        eligible: 900,
        ineligible: 100,
        pending: 0,
        errors: 0,
        startedAt: new Date(),
        finishedAt: new Date(),
        promotedAt: null,
        promotedBy: null,
      });

      const result = await service.getRunStatus('run-1');

      expect(result.readyToPromote).toBe(true);
      expect(result.blockingReasons).toEqual([]);
    });

    it('should be false when status is not success', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        targetPolicyId: 'policy-1',
        targetPolicyVersion: 2,
        status: 'running',
        totalReadySnapshot: 1000,
        processed: 1000,
        eligible: 900,
        ineligible: 100,
        pending: 0,
        errors: 0,
        startedAt: new Date(),
        finishedAt: null,
        promotedAt: null,
        promotedBy: null,
      });

      const result = await service.getRunStatus('run-1');

      expect(result.readyToPromote).toBe(false);
      expect(result.blockingReasons).toContain('RUN_NOT_SUCCESS');
    });

    it('should be false when coverage < 100%', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        targetPolicyId: 'policy-1',
        targetPolicyVersion: 2,
        status: 'success',
        totalReadySnapshot: 1000,
        processed: 999,
        eligible: 899,
        ineligible: 100,
        pending: 0,
        errors: 0,
        startedAt: new Date(),
        finishedAt: new Date(),
        promotedAt: null,
        promotedBy: null,
      });

      const result = await service.getRunStatus('run-1');

      expect(result.readyToPromote).toBe(false);
      expect(result.blockingReasons).toContain('COVERAGE_NOT_MET');
    });

    it('should be false when errors > 0', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        targetPolicyId: 'policy-1',
        targetPolicyVersion: 2,
        status: 'success',
        totalReadySnapshot: 1000,
        processed: 1000,
        eligible: 899,
        ineligible: 100,
        pending: 0,
        errors: 1,
        startedAt: new Date(),
        finishedAt: new Date(),
        promotedAt: null,
        promotedBy: null,
      });

      const result = await service.getRunStatus('run-1');

      expect(result.readyToPromote).toBe(false);
      expect(result.blockingReasons).toContain('ERRORS_EXCEEDED');
    });

    it('should be false when already promoted', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        targetPolicyId: 'policy-1',
        targetPolicyVersion: 2,
        status: 'promoted',
        totalReadySnapshot: 1000,
        processed: 1000,
        eligible: 900,
        ineligible: 100,
        pending: 0,
        errors: 0,
        startedAt: new Date(),
        finishedAt: new Date(),
        promotedAt: new Date(),
        promotedBy: 'admin',
      });

      const result = await service.getRunStatus('run-1');

      expect(result.readyToPromote).toBe(false);
      expect(result.blockingReasons).toContain('ALREADY_PROMOTED');
    });

    it('should accumulate multiple blocking reasons', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        targetPolicyId: 'policy-1',
        targetPolicyVersion: 2,
        status: 'running',
        totalReadySnapshot: 1000,
        processed: 500,
        eligible: 400,
        ineligible: 95,
        pending: 0,
        errors: 5,
        startedAt: new Date(),
        finishedAt: null,
        promotedAt: null,
        promotedBy: null,
      });

      const result = await service.getRunStatus('run-1');

      expect(result.readyToPromote).toBe(false);
      expect(result.blockingReasons).toContain('RUN_NOT_SUCCESS');
      expect(result.blockingReasons).toContain('COVERAGE_NOT_MET');
      expect(result.blockingReasons).toContain('ERRORS_EXCEEDED');
    });
  });

  describe('promoteRun', () => {
    /**
     * Property 7: Promote Status Validation
     *
     * Promote only allowed when status=SUCCESS
     *
     * Validates: Requirements 3.1, 3.2, 3.8
     */
    it('should fail when run not found', async () => {
      mockRunRepository.findById.mockResolvedValue(null);

      const result = await service.promoteRun('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when status is not success', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'running',
        totalReadySnapshot: 1000,
        processed: 1000,
        errors: 0,
        promotedAt: null,
        targetPolicyId: 'policy-1',
      });

      const result = await service.promoteRun('run-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('status is running');
    });

    it('should fail when coverage below threshold', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'success',
        totalReadySnapshot: 1000,
        processed: 900,
        errors: 0,
        promotedAt: null,
        targetPolicyId: 'policy-1',
      });

      const result = await service.promoteRun('run-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Coverage');
    });

    it('should fail when errors exceed threshold', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'success',
        totalReadySnapshot: 1000,
        processed: 1000,
        errors: 5,
        promotedAt: null,
        targetPolicyId: 'policy-1',
      });

      const result = await service.promoteRun('run-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Errors');
    });

    it('should fail when already promoted', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'success',
        totalReadySnapshot: 1000,
        processed: 1000,
        errors: 0,
        promotedAt: new Date(),
        targetPolicyId: 'policy-1',
      });

      const result = await service.promoteRun('run-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already promoted');
    });

    it('should succeed and activate policy when all conditions met', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'success',
        totalReadySnapshot: 1000,
        processed: 1000,
        errors: 0,
        promotedAt: null,
        targetPolicyId: 'policy-1',
        targetPolicyVersion: 2,
      });
      mockPolicyRepository.activate.mockResolvedValue(undefined);
      mockRunRepository.update.mockResolvedValue(undefined);

      const result = await service.promoteRun('run-1');

      expect(result.success).toBe(true);
      expect(mockPolicyRepository.activate).toHaveBeenCalledWith('policy-1');
      expect(mockRunRepository.update).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          status: 'promoted',
        }),
      );
    });

    it('should allow custom coverage threshold', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'success',
        totalReadySnapshot: 1000,
        processed: 950,
        errors: 0,
        promotedAt: null,
        targetPolicyId: 'policy-1',
        targetPolicyVersion: 2,
      });
      mockPolicyRepository.activate.mockResolvedValue(undefined);
      mockRunRepository.update.mockResolvedValue(undefined);

      const result = await service.promoteRun('run-1', { coverageThreshold: 0.95 });

      expect(result.success).toBe(true);
    });

    it('should allow custom error threshold', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'success',
        totalReadySnapshot: 1000,
        processed: 1000,
        errors: 5,
        promotedAt: null,
        targetPolicyId: 'policy-1',
        targetPolicyVersion: 2,
      });
      mockPolicyRepository.activate.mockResolvedValue(undefined);
      mockRunRepository.update.mockResolvedValue(undefined);

      const result = await service.promoteRun('run-1', { maxErrors: 10 });

      expect(result.success).toBe(true);
    });
  });

  describe('cancelRun', () => {
    it('should fail when run not found', async () => {
      mockRunRepository.findById.mockResolvedValue(null);

      const result = await service.cancelRun('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when run is not running', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'success',
      });

      const result = await service.cancelRun('run-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('can only cancel running runs');
    });

    it('should succeed when run is running', async () => {
      mockRunRepository.findById.mockResolvedValue({
        id: 'run-1',
        status: 'running',
      });
      mockRunRepository.update.mockResolvedValue(undefined);

      const result = await service.cancelRun('run-1');

      expect(result.success).toBe(true);
      expect(mockRunRepository.update).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          status: 'cancelled',
        }),
      );
    });
  });
});
