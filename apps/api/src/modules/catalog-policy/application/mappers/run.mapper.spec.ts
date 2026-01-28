/**
 * Run Mapper Tests
 *
 * Unit tests for RunMapper functions.
 */

import { RunMapper } from './run.mapper';
import { type RunStatus, type RunListItem } from '../services/policy-activation.service';
import { type DiffReport, type DiffSample } from '../../domain/types/diff.types';

describe('RunMapper', () => {
  describe('toListDto', () => {
    const createMockRunListItem = (overrides: Partial<RunListItem> = {}): RunListItem => ({
      id: 'run-123',
      policyId: 'policy-456',
      policyName: 'Policy v2',
      policyVersion: 2,
      status: 'prepared',
      progress: {
        processed: 1000,
        total: 1000,
        eligible: 800,
        ineligible: 150,
        errors: 50,
      },
      startedAt: new Date('2024-01-01T10:00:00Z'),
      finishedAt: new Date('2024-01-01T12:00:00Z'),
      readyToPromote: true,
      ...overrides,
    });

    it('should map run list item to DTO', () => {
      const run = createMockRunListItem();

      const result = RunMapper.toListDto(run);

      expect(result).toEqual({
        id: 'run-123',
        policyId: 'policy-456',
        policyName: 'Policy v2',
        policyVersion: 2,
        status: 'prepared',
        progress: {
          processed: 1000,
          total: 1000,
          eligible: 800,
          ineligible: 150,
          errors: 50,
        },
        startedAt: new Date('2024-01-01T10:00:00Z'),
        finishedAt: new Date('2024-01-01T12:00:00Z'),
        readyToPromote: true,
      });
    });

    it('should handle undefined finishedAt', () => {
      const run = createMockRunListItem({ finishedAt: undefined });

      const result = RunMapper.toListDto(run);

      expect(result.finishedAt).toBeUndefined();
    });
  });

  describe('toListDtos', () => {
    it('should map multiple runs', () => {
      const runs: RunListItem[] = [
        {
          id: 'run-1',
          policyId: 'policy-1',
          policyName: 'Policy v1',
          policyVersion: 1,
          status: 'running',
          progress: { processed: 500, total: 1000, eligible: 400, ineligible: 100, errors: 0 },
          startedAt: new Date('2024-01-01'),
          readyToPromote: false,
        },
        {
          id: 'run-2',
          policyId: 'policy-2',
          policyName: 'Policy v2',
          policyVersion: 2,
          status: 'prepared',
          progress: { processed: 1000, total: 1000, eligible: 800, ineligible: 200, errors: 0 },
          startedAt: new Date('2024-01-02'),
          finishedAt: new Date('2024-01-02'),
          readyToPromote: true,
        },
      ];

      const result = RunMapper.toListDtos(runs);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('run-1');
      expect(result[1].id).toBe('run-2');
    });

    it('should return empty array for empty input', () => {
      expect(RunMapper.toListDtos([])).toEqual([]);
    });
  });

  describe('toStatusDto', () => {
    const createMockRunStatus = (overrides: Partial<RunStatus> = {}): RunStatus => ({
      id: 'run-123',
      targetPolicyId: 'policy-456',
      targetPolicyVersion: 2,
      status: 'prepared',
      totalReadySnapshot: 1000,
      processed: 1000,
      eligible: 800,
      ineligible: 150,
      errors: 50,
      startedAt: new Date('2024-01-01T10:00:00Z'),
      finishedAt: new Date('2024-01-01T12:00:00Z'),
      promotedAt: null,
      promotedBy: null,
      readyToPromote: true,
      blockingReasons: [],
      coverage: 1.0,
      ...overrides,
    });

    it('should map run status to DTO', () => {
      const status = createMockRunStatus();

      const result = RunMapper.toStatusDto(status);

      expect(result.id).toBe('run-123');
      expect(result.targetPolicyId).toBe('policy-456');
      expect(result.targetPolicyVersion).toBe(2);
      expect(result.status).toBe('prepared');
      expect(result.progress).toEqual({
        processed: 1000,
        total: 1000,
        eligible: 800,
        ineligible: 150,
        errors: 50,
      });
      expect(result.readyToPromote).toBe(true);
      expect(result.blockingReasons).toEqual([]);
      expect(result.coverage).toBe(1.0);
      expect(result.errorSample).toEqual([]);
    });

    it('should include optional fields when present', () => {
      const status = createMockRunStatus({
        promotedAt: new Date('2024-01-01T14:00:00Z'),
        promotedBy: 'admin@example.com',
      });

      const result = RunMapper.toStatusDto(status);

      expect(result.promotedAt).toEqual(new Date('2024-01-01T14:00:00Z'));
      expect(result.promotedBy).toBe('admin@example.com');
    });

    it('should not include optional fields when null', () => {
      const status = createMockRunStatus({
        finishedAt: null,
        promotedAt: null,
        promotedBy: null,
      });

      const result = RunMapper.toStatusDto(status);

      expect('finishedAt' in result).toBe(false);
      expect('promotedAt' in result).toBe(false);
      expect('promotedBy' in result).toBe(false);
    });
  });

  describe('toDiffReportDto', () => {
    const createMockDiffReport = (overrides: Partial<DiffReport> = {}): DiffReport => ({
      runId: 'run-123',
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
          trendingScore: 85,
        },
      ],
      topImprovements: [
        {
          mediaItemId: 'item-2',
          title: 'Movie 2',
          oldStatus: 'ineligible',
          newStatus: 'eligible',
          trendingScore: 75,
        },
      ],
      ...overrides,
    });

    it('should map diff report to DTO', () => {
      const report = createMockDiffReport();

      const result = RunMapper.toDiffReportDto(report);

      expect(result.runId).toBe('run-123');
      expect(result.targetPolicyVersion).toBe(2);
      expect(result.currentPolicyVersion).toBe(1);
      expect(result.counts).toEqual({
        regressions: 10,
        improvements: 50,
        netChange: 40,
      });
    });

    it('should map regressions and improvements', () => {
      const report = createMockDiffReport();

      const result = RunMapper.toDiffReportDto(report);

      expect(result.topRegressions).toHaveLength(1);
      expect(result.topRegressions[0]).toEqual({
        mediaItemId: 'item-1',
        title: 'Movie 1',
        reason: 'Status change: eligible → ineligible',
      });

      expect(result.topImprovements).toHaveLength(1);
      expect(result.topImprovements[0]).toEqual({
        mediaItemId: 'item-2',
        title: 'Movie 2',
        reason: 'Status change: ineligible → eligible',
      });
    });

    it('should not include currentPolicyVersion when null', () => {
      const report = createMockDiffReport({ currentPolicyVersion: null });

      const result = RunMapper.toDiffReportDto(report);

      expect('currentPolicyVersion' in result).toBe(false);
    });

    it('should include reasonBreakdown when present', () => {
      const report = createMockDiffReport({
        reasonBreakdown: {
          regressionReasons: { MISSING_GLOBAL_SIGNALS: 5, BLOCKED_COUNTRY: 5 },
          improvementReasons: { ALLOWED_COUNTRY: 30, BREAKOUT_ALLOWED: 20 },
        },
      });

      const result = RunMapper.toDiffReportDto(report);

      expect(result.reasonBreakdown).toEqual({
        regressionReasons: { MISSING_GLOBAL_SIGNALS: 5, BLOCKED_COUNTRY: 5 },
        improvementReasons: { ALLOWED_COUNTRY: 30, BREAKOUT_ALLOWED: 20 },
      });
    });
  });

  describe('toDiffSampleDto', () => {
    it('should map diff sample to DTO', () => {
      const sample: DiffSample = {
        mediaItemId: 'item-123',
        title: 'Test Movie',
        oldStatus: 'eligible',
        newStatus: 'ineligible',
        trendingScore: 80,
      };

      const result = RunMapper.toDiffSampleDto(sample);

      expect(result).toEqual({
        mediaItemId: 'item-123',
        title: 'Test Movie',
        reason: 'Status change: eligible → ineligible',
      });
    });

    it('should use Unknown for null title', () => {
      const sample: DiffSample = {
        mediaItemId: 'item-123',
        title: null,
        oldStatus: 'ineligible',
        newStatus: 'eligible',
        trendingScore: null,
      };

      const result = RunMapper.toDiffSampleDto(sample);

      expect(result.title).toBe('Unknown');
    });
  });

  describe('calculateNetChange', () => {
    it('should calculate positive net change', () => {
      expect(RunMapper.calculateNetChange(100, 20)).toBe(80);
    });

    it('should calculate negative net change', () => {
      expect(RunMapper.calculateNetChange(20, 100)).toBe(-80);
    });

    it('should return zero when equal', () => {
      expect(RunMapper.calculateNetChange(50, 50)).toBe(0);
    });
  });

  describe('formatStatusChangeReason', () => {
    it('should format status change reason', () => {
      expect(RunMapper.formatStatusChangeReason('eligible', 'ineligible')).toBe(
        'Status change: eligible → ineligible',
      );
    });
  });
});
