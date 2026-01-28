/**
 * DiffRepository Unit Tests
 */

import { Test } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { EligibilityStatus, DIFF_STATUS_NONE } from '../../domain/constants/evaluation.constants';

import { DiffRepository } from './diff.repository';

describe('DiffRepository', () => {
  let repository: DiffRepository;
  let mockDb: { execute: jest.Mock };

  beforeEach(async () => {
    mockDb = {
      execute: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DiffRepository,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    repository = moduleRef.get<DiffRepository>(DiffRepository);
  });

  describe('computeDiffCounts', () => {
    it('should return parsed counts from SQL result', async () => {
      mockDb.execute.mockResolvedValue([
        { regressions: '10', improvements: '20', unchanged: '100', still_ineligible: '50' },
      ]);

      const result = await repository.computeDiffCounts(2, 1);

      expect(result).toEqual({
        regressions: 10,
        improvements: 20,
        unchanged: 100,
        stillIneligible: 50,
      });
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });

    it('should return zeros when SQL returns empty result', async () => {
      mockDb.execute.mockResolvedValue([]);

      const result = await repository.computeDiffCounts(2, 1);

      expect(result).toEqual({
        regressions: 0,
        improvements: 0,
        unchanged: 0,
        stillIneligible: 0,
      });
    });

    it('should handle null baselineVersion', async () => {
      mockDb.execute.mockResolvedValue([
        { regressions: '0', improvements: '500', unchanged: '0', still_ineligible: '100' },
      ]);

      const result = await repository.computeDiffCounts(1, null);

      expect(result.improvements).toBe(500);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDiffSamples', () => {
    it('should return mapped samples for regressions', async () => {
      mockDb.execute.mockResolvedValue([
        {
          media_item_id: 'item-1',
          title: 'Movie 1',
          old_status: EligibilityStatus.ELIGIBLE,
          new_status: EligibilityStatus.INELIGIBLE,
          trending_score: 95,
        },
        {
          media_item_id: 'item-2',
          title: 'Movie 2',
          old_status: EligibilityStatus.ELIGIBLE,
          new_status: DIFF_STATUS_NONE,
          trending_score: 80,
        },
      ]);

      const result = await repository.getDiffSamples(2, 1, 'regression', 10);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        mediaItemId: 'item-1',
        title: 'Movie 1',
        oldStatus: EligibilityStatus.ELIGIBLE,
        newStatus: EligibilityStatus.INELIGIBLE,
        trendingScore: 95,
      });
    });

    it('should return mapped samples for improvements', async () => {
      mockDb.execute.mockResolvedValue([
        {
          media_item_id: 'item-1',
          title: 'Movie 1',
          old_status: EligibilityStatus.INELIGIBLE,
          new_status: EligibilityStatus.ELIGIBLE,
          trending_score: 90,
        },
      ]);

      const result = await repository.getDiffSamples(2, 1, 'improvement', 10);

      expect(result).toHaveLength(1);
      expect(result[0].oldStatus).toBe(EligibilityStatus.INELIGIBLE);
      expect(result[0].newStatus).toBe(EligibilityStatus.ELIGIBLE);
    });

    it('should return empty array when no samples found', async () => {
      mockDb.execute.mockResolvedValue([]);

      const result = await repository.getDiffSamples(2, 1, 'regression', 10);

      expect(result).toEqual([]);
    });

    it('should handle null title and trendingScore', async () => {
      mockDb.execute.mockResolvedValue([
        {
          media_item_id: 'item-1',
          title: null,
          old_status: EligibilityStatus.ELIGIBLE,
          new_status: EligibilityStatus.INELIGIBLE,
          trending_score: null,
        },
      ]);

      const result = await repository.getDiffSamples(2, 1, 'regression', 10);

      expect(result[0].title).toBeNull();
      expect(result[0].trendingScore).toBeNull();
    });

    it('should handle null baselineVersion', async () => {
      mockDb.execute.mockResolvedValue([
        {
          media_item_id: 'item-1',
          title: 'New Movie',
          old_status: DIFF_STATUS_NONE,
          new_status: EligibilityStatus.ELIGIBLE,
          trending_score: 85,
        },
      ]);

      const result = await repository.getDiffSamples(1, null, 'improvement', 10);

      expect(result).toHaveLength(1);
      expect(result[0].oldStatus).toBe(DIFF_STATUS_NONE);
      expect(result[0].newStatus).toBe(EligibilityStatus.ELIGIBLE);
    });

    it('should map new items (DIFF_STATUS_NONE → ELIGIBLE) as improvements', async () => {
      mockDb.execute.mockResolvedValue([
        {
          media_item_id: 'new-item',
          title: 'Brand New Movie',
          old_status: DIFF_STATUS_NONE,
          new_status: EligibilityStatus.ELIGIBLE,
          trending_score: 100,
        },
      ]);

      const result = await repository.getDiffSamples(2, 1, 'improvement', 10);

      expect(result[0].mediaItemId).toBe('new-item');
      expect(result[0].oldStatus).toBe(DIFF_STATUS_NONE);
    });
  });

  describe('computeReasonBreakdown', () => {
    it('should return breakdown of reasons', async () => {
      mockDb.execute.mockResolvedValue([
        { diff_type: 'regression', reason: 'BLOCKED_COUNTRY', count: '5' },
        { diff_type: 'regression', reason: 'BLOCKED_LANGUAGE', count: '3' },
        { diff_type: 'improvement', reason: 'ALLOWED_COUNTRY', count: '10' },
      ]);

      const result = await repository.computeReasonBreakdown(2, 1);

      expect(result.regressionReasons).toEqual({
        BLOCKED_COUNTRY: 5,
        BLOCKED_LANGUAGE: 3,
      });
      expect(result.improvementReasons).toEqual({
        ALLOWED_COUNTRY: 10,
      });
    });

    it('should return empty objects when no reasons found', async () => {
      mockDb.execute.mockResolvedValue([]);

      const result = await repository.computeReasonBreakdown(2, 1);

      expect(result).toEqual({
        regressionReasons: {},
        improvementReasons: {},
      });
    });

    it('should handle null baselineVersion', async () => {
      mockDb.execute.mockResolvedValue([
        { diff_type: 'improvement', reason: 'ALLOWED_COUNTRY', count: '100' },
      ]);

      const result = await repository.computeReasonBreakdown(1, null);

      expect(result.improvementReasons).toEqual({ ALLOWED_COUNTRY: 100 });
      expect(result.regressionReasons).toEqual({});
    });
  });
});
