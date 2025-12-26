import { Test, TestingModule } from '@nestjs/testing';
import { MediaCatalogEvaluationRepository } from './media-catalog-evaluation.repository';
import { MediaCatalogEvaluation } from '../../domain/types/policy.types';
import { EligibilityStatusType } from '../../domain/constants/evaluation.constants';
import { DatabaseException } from '../../../../common/exceptions';

/**
 * MediaCatalogEvaluationRepository Tests
 *
 * Tests repository operations with canonical lowercase status values.
 * Note: Legacy toDbStatus conversion has been removed - status values
 * are now stored directly in canonical lowercase format.
 */
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

  describe('upsert with canonical lowercase status', () => {
    it('should store eligible status directly', async () => {
      const evaluation: MediaCatalogEvaluation = {
        mediaItemId: 'media-1',
        status: 'eligible',
        reasons: ['ALLOWED_COUNTRY'],
        relevanceScore: 85,
        policyVersion: 1,
        evaluatedAt: new Date(),
        breakoutRuleId: null,
      };

      mockDb.returning.mockResolvedValue([
        {
          mediaItemId: 'media-1',
          status: 'eligible',
          reasons: ['ALLOWED_COUNTRY'],
          relevanceScore: 85,
          policyVersion: 1,
          evaluatedAt: new Date(),
          breakoutRuleId: null,
        },
      ]);

      await repository.upsert(evaluation);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'eligible',
        }),
      );
    });

    it('should store ineligible status directly', async () => {
      const evaluation: MediaCatalogEvaluation = {
        mediaItemId: 'media-2',
        status: 'ineligible',
        reasons: ['BLOCKED_COUNTRY'],
        relevanceScore: 25,
        policyVersion: 1,
        evaluatedAt: new Date(),
        breakoutRuleId: null,
      };

      mockDb.returning.mockResolvedValue([
        {
          mediaItemId: 'media-2',
          status: 'ineligible',
          reasons: ['BLOCKED_COUNTRY'],
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

    it('should store pending status directly', async () => {
      const evaluation: MediaCatalogEvaluation = {
        mediaItemId: 'media-3',
        status: 'pending',
        reasons: ['MISSING_ORIGIN_COUNTRY'],
        relevanceScore: 50,
        policyVersion: 1,
        evaluatedAt: new Date(),
        breakoutRuleId: null,
      };

      mockDb.returning.mockResolvedValue([
        {
          mediaItemId: 'media-3',
          status: 'pending',
          reasons: ['MISSING_ORIGIN_COUNTRY'],
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

    it('should store review status directly', async () => {
      const evaluation: MediaCatalogEvaluation = {
        mediaItemId: 'media-4',
        status: 'review',
        reasons: ['NEUTRAL_COUNTRY'],
        relevanceScore: 60,
        policyVersion: 1,
        evaluatedAt: new Date(),
        breakoutRuleId: null,
      };

      mockDb.returning.mockResolvedValue([
        {
          mediaItemId: 'media-4',
          status: 'review',
          reasons: ['NEUTRAL_COUNTRY'],
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
  });

  describe('bulkUpsert with canonical lowercase status', () => {
    it('should store multiple evaluations with canonical status values', async () => {
      const evaluations: MediaCatalogEvaluation[] = [
        {
          mediaItemId: 'media-1',
          status: 'eligible',
          reasons: ['ALLOWED_COUNTRY'],
          relevanceScore: 85,
          policyVersion: 1,
          evaluatedAt: new Date(),
          breakoutRuleId: null,
        },
        {
          mediaItemId: 'media-2',
          status: 'ineligible',
          reasons: ['BLOCKED_COUNTRY'],
          relevanceScore: 25,
          policyVersion: 1,
          evaluatedAt: new Date(),
          breakoutRuleId: null,
        },
      ];

      mockDb.returning.mockResolvedValue([]);

      await repository.bulkUpsert(evaluations);

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
        status: 'eligible',
        reasons: ['ALLOWED_COUNTRY'],
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
          status: 'eligible',
          reasons: ['ALLOWED_COUNTRY'],
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
