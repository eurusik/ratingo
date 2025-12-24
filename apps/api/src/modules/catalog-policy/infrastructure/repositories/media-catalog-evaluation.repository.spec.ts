import { Test, TestingModule } from '@nestjs/testing';
import { MediaCatalogEvaluationRepository } from './media-catalog-evaluation.repository';
import { MediaCatalogEvaluation, EligibilityStatus } from '../../domain/types/policy.types';
import { EligibilityStatusType } from '../../domain/constants/evaluation.constants';
import { DatabaseException } from '../../../../common/exceptions';

// Test the toDbStatus function indirectly through the repository
describe('MediaCatalogEvaluationRepository', () => {
  let repository: MediaCatalogEvaluationRepository;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflictDoUpdate: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaCatalogEvaluationRepository,
        { provide: 'DATABASE_CONNECTION', useValue: mockDb },
      ],
    }).compile();

    repository = module.get<MediaCatalogEvaluationRepository>(MediaCatalogEvaluationRepository);
  });

  describe('toDbStatus function (tested indirectly)', () => {
    it('should convert ELIGIBLE to eligible when upserting', async () => {
      const evaluation: MediaCatalogEvaluation = {
        mediaItemId: 'media-1',
        status: 'ELIGIBLE' as EligibilityStatus,
        reasons: ['MEETS_CRITERIA'],
        relevanceScore: 85,
        policyVersion: 1,
        evaluatedAt: new Date(),
        breakoutRuleId: null,
      };

      mockDb.returning.mockResolvedValue([
        {
          mediaItemId: 'media-1',
          status: 'eligible',
          reasons: ['MEETS_CRITERIA'],
          relevanceScore: 85,
          policyVersion: 1,
          evaluatedAt: new Date(),
          breakoutRuleId: null,
        },
      ]);

      await repository.upsert(evaluation);

      // Verify that the status was converted to lowercase for DB storage
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'eligible',
        }),
      );
    });

    it('should convert INELIGIBLE to ineligible when upserting', async () => {
      const evaluation: MediaCatalogEvaluation = {
        mediaItemId: 'media-2',
        status: 'INELIGIBLE' as EligibilityStatus,
        reasons: ['FAILS_CRITERIA'],
        relevanceScore: 25,
        policyVersion: 1,
        evaluatedAt: new Date(),
        breakoutRuleId: null,
      };

      mockDb.returning.mockResolvedValue([
        {
          mediaItemId: 'media-2',
          status: 'ineligible',
          reasons: ['FAILS_CRITERIA'],
          relevanceScore: 25,
          policyVersion: 1,
          evaluatedAt: new Date(),
          breakoutRuleId: null,
        },
      ]);

      await repository.upsert(evaluation);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ineligible',
        }),
      );
    });

    it('should convert PENDING to pending when upserting', async () => {
      const evaluation: MediaCatalogEvaluation = {
        mediaItemId: 'media-3',
        status: 'PENDING' as EligibilityStatus,
        reasons: ['AWAITING_REVIEW'],
        relevanceScore: 50,
        policyVersion: 1,
        evaluatedAt: new Date(),
        breakoutRuleId: null,
      };

      mockDb.returning.mockResolvedValue([
        {
          mediaItemId: 'media-3',
          status: 'pending',
          reasons: ['AWAITING_REVIEW'],
          relevanceScore: 50,
          policyVersion: 1,
          evaluatedAt: new Date(),
          breakoutRuleId: null,
        },
      ]);

      await repository.upsert(evaluation);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
        }),
      );
    });

    it('should convert REVIEW to review when upserting', async () => {
      const evaluation: MediaCatalogEvaluation = {
        mediaItemId: 'media-4',
        status: 'REVIEW' as EligibilityStatus,
        reasons: ['NEEDS_MANUAL_REVIEW'],
        relevanceScore: 60,
        policyVersion: 1,
        evaluatedAt: new Date(),
        breakoutRuleId: null,
      };

      mockDb.returning.mockResolvedValue([
        {
          mediaItemId: 'media-4',
          status: 'review',
          reasons: ['NEEDS_MANUAL_REVIEW'],
          relevanceScore: 60,
          policyVersion: 1,
          evaluatedAt: new Date(),
          breakoutRuleId: null,
        },
      ]);

      await repository.upsert(evaluation);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'review',
        }),
      );
    });

    it('should convert status in bulk upsert operations', async () => {
      const evaluations: MediaCatalogEvaluation[] = [
        {
          mediaItemId: 'media-1',
          status: 'ELIGIBLE' as EligibilityStatus,
          reasons: ['MEETS_CRITERIA'],
          relevanceScore: 85,
          policyVersion: 1,
          evaluatedAt: new Date(),
          breakoutRuleId: null,
        },
        {
          mediaItemId: 'media-2',
          status: 'INELIGIBLE' as EligibilityStatus,
          reasons: ['FAILS_CRITERIA'],
          relevanceScore: 25,
          policyVersion: 1,
          evaluatedAt: new Date(),
          breakoutRuleId: null,
        },
      ];

      mockDb.returning.mockResolvedValue([]);

      await repository.bulkUpsert(evaluations);

      // Verify that both statuses were converted to lowercase
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ status: 'eligible' }),
          expect.objectContaining({ status: 'ineligible' }),
        ]),
      );
    });
  });

  describe('error handling', () => {
    it('should throw DatabaseException when upsert fails', async () => {
      const evaluation: MediaCatalogEvaluation = {
        mediaItemId: 'media-1',
        status: 'ELIGIBLE' as EligibilityStatus,
        reasons: ['MEETS_CRITERIA'],
        relevanceScore: 85,
        policyVersion: 1,
        evaluatedAt: new Date(),
        breakoutRuleId: null,
      };

      mockDb.returning.mockRejectedValue(new Error('DB Error'));

      await expect(repository.upsert(evaluation)).rejects.toThrow(DatabaseException);
    });

    it('should throw DatabaseException when bulk upsert fails', async () => {
      const evaluations: MediaCatalogEvaluation[] = [
        {
          mediaItemId: 'media-1',
          status: 'ELIGIBLE' as EligibilityStatus,
          reasons: ['MEETS_CRITERIA'],
          relevanceScore: 85,
          policyVersion: 1,
          evaluatedAt: new Date(),
          breakoutRuleId: null,
        },
      ];

      mockDb.returning.mockRejectedValue(new Error('DB Error'));

      await expect(repository.bulkUpsert(evaluations)).rejects.toThrow(DatabaseException);
    });
  });
});
