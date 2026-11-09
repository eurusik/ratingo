import { PgDialect } from 'drizzle-orm/pg-core';
import { MediaStubUpsertQuery } from './media-stub-upsert.query';
import { createDrizzleThenable } from '../__test__/drizzle-mock.utils';
import { MediaType } from '@/common/enums/media-type.enum';
import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { DatabaseException } from '@/common/exceptions';
import { PG_ERROR_CODE, DB_CONSTRAINT } from '@/common/constants/database.constants';

describe('MediaStubUpsertQuery', () => {
  describe('execute', () => {
    const stubPayload = {
      tmdbId: 72350,
      type: MediaType.SHOW,
      title: 'Test Show',
      slug: 'test-show',
      ingestionStatus: IngestionStatus.IMPORTING,
    };

    it('should return id and slug on successful insert', async () => {
      const insertChain = createDrizzleThenable([{ id: 'new-id', slug: 'test-show' }]);
      const query = new MediaStubUpsertQuery({
        insert: jest.fn().mockReturnValue(insertChain),
      } as any);

      const result = await query.execute(stubPayload);

      expect(result).toEqual({ id: 'new-id', slug: 'test-show' });
    });

    it('should never downgrade a READY item on conflict (forced re-sync)', async () => {
      const insertChain = createDrizzleThenable([{ id: 'new-id', slug: 'test-show' }]);
      const query = new MediaStubUpsertQuery({
        insert: jest.fn().mockReturnValue(insertChain),
      } as any);

      await query.execute(stubPayload);

      const { set } = insertChain.onConflictDoUpdate.mock.calls[0][0];
      const { sql: statusSql, params } = new PgDialect().sqlToQuery(set.ingestionStatus);
      expect(statusSql).toContain('CASE WHEN');
      expect(statusSql).toContain('excluded.ingestion_status');
      expect(params).toContain(IngestionStatus.READY);
    });

    it('should return existing record on race condition (same tmdbId)', async () => {
      // Arrange: INSERT fails with slug constraint, SELECT returns same tmdbId
      const slugConflictError = Object.assign(new Error('unique_violation'), {
        code: PG_ERROR_CODE.UNIQUE_VIOLATION,
        constraint_name: DB_CONSTRAINT.MEDIA_TYPE_SLUG,
      });
      const insertChain = createDrizzleThenable([], slugConflictError);
      const selectChain = createDrizzleThenable([
        { id: 'existing-id', slug: 'test-show', tmdbId: 72350 },
      ]);

      const mockDb = {
        insert: jest.fn().mockReturnValue(insertChain),
        select: jest.fn().mockReturnValue(selectChain),
      };

      const query = new MediaStubUpsertQuery(mockDb as any);

      // Act
      const result = await query.execute(stubPayload);

      // Assert
      expect(result).toEqual({ id: 'existing-id', slug: 'test-show' });
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should retry with unique slug on real slug collision (different tmdbId)', async () => {
      // Arrange: INSERT fails with slug constraint, SELECT returns different tmdbId
      const slugConflictError = Object.assign(new Error('unique_violation'), {
        code: PG_ERROR_CODE.UNIQUE_VIOLATION,
        constraint_name: DB_CONSTRAINT.MEDIA_TYPE_SLUG,
      });
      const failingInsertChain = createDrizzleThenable([], slugConflictError);
      const selectChain = createDrizzleThenable([
        { id: 'other-id', slug: 'test-show', tmdbId: 99999 },
      ]);
      const retryInsertChain = createDrizzleThenable([{ id: 'new-id', slug: 'test-show-72350' }]);

      let insertCallCount = 0;
      const mockDb = {
        insert: jest.fn().mockImplementation(() => {
          insertCallCount++;
          return insertCallCount === 1 ? failingInsertChain : retryInsertChain;
        }),
        select: jest.fn().mockReturnValue(selectChain),
      };

      const query = new MediaStubUpsertQuery(mockDb as any);

      // Act
      const result = await query.execute(stubPayload);

      // Assert
      expect(result).toEqual({ id: 'new-id', slug: 'test-show-72350' });
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should throw DatabaseException on non-slug constraint error', async () => {
      const otherError = Object.assign(new Error('other_error'), {
        code: PG_ERROR_CODE.UNIQUE_VIOLATION,
        constraint_name: 'media_type_tmdb_idx', // Different constraint
      });
      const insertChain = createDrizzleThenable([], otherError);

      const query = new MediaStubUpsertQuery({
        insert: jest.fn().mockReturnValue(insertChain),
      } as any);

      await expect(query.execute(stubPayload)).rejects.toThrow(DatabaseException);
    });

    it('should handle error wrapped in cause (Drizzle style)', async () => {
      // Drizzle wraps PostgreSQL errors in cause
      const slugConflictError = Object.assign(new Error('wrapper'), {
        cause: {
          code: PG_ERROR_CODE.UNIQUE_VIOLATION,
          constraint_name: DB_CONSTRAINT.MEDIA_TYPE_SLUG,
        },
      });
      const insertChain = createDrizzleThenable([], slugConflictError);
      const selectChain = createDrizzleThenable([
        { id: 'existing-id', slug: 'test-show', tmdbId: 72350 },
      ]);

      const mockDb = {
        insert: jest.fn().mockReturnValue(insertChain),
        select: jest.fn().mockReturnValue(selectChain),
      };

      const query = new MediaStubUpsertQuery(mockDb as any);

      const result = await query.execute(stubPayload);

      expect(result).toEqual({ id: 'existing-id', slug: 'test-show' });
    });

    it('should throw DatabaseException when slug conflict but SELECT returns empty', async () => {
      // Edge case: constraint error says slug exists, but SELECT finds nothing
      // (theoretically impossible, but defensive coding)
      const slugConflictError = Object.assign(new Error('unique_violation'), {
        code: PG_ERROR_CODE.UNIQUE_VIOLATION,
        constraint_name: DB_CONSTRAINT.MEDIA_TYPE_SLUG,
      });
      const insertChain = createDrizzleThenable([], slugConflictError);
      const selectChain = createDrizzleThenable([]); // Empty result

      const mockDb = {
        insert: jest.fn().mockReturnValue(insertChain),
        select: jest.fn().mockReturnValue(selectChain),
      };

      const query = new MediaStubUpsertQuery(mockDb as any);

      await expect(query.execute(stubPayload)).rejects.toThrow(DatabaseException);
    });

    it('should throw DatabaseException when retry with unique slug also fails', async () => {
      // Arrange: first INSERT fails on slug, SELECT finds different tmdbId,
      // retry INSERT also fails (e.g., unique slug already taken)
      const slugConflictError = Object.assign(new Error('unique_violation'), {
        code: PG_ERROR_CODE.UNIQUE_VIOLATION,
        constraint_name: DB_CONSTRAINT.MEDIA_TYPE_SLUG,
      });
      const failingInsertChain = createDrizzleThenable([], slugConflictError);
      const selectChain = createDrizzleThenable([
        { id: 'other-id', slug: 'test-show', tmdbId: 99999 },
      ]);
      const retryFailError = new Error('Connection lost');
      const retryInsertChain = createDrizzleThenable([], retryFailError);

      let insertCallCount = 0;
      const mockDb = {
        insert: jest.fn().mockImplementation(() => {
          insertCallCount++;
          return insertCallCount === 1 ? failingInsertChain : retryInsertChain;
        }),
        select: jest.fn().mockReturnValue(selectChain),
      };

      const query = new MediaStubUpsertQuery(mockDb as any);

      await expect(query.execute(stubPayload)).rejects.toThrow('Connection lost');
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should throw DatabaseException on generic DB error (not unique_violation)', async () => {
      const genericError = new Error('Connection refused');
      const insertChain = createDrizzleThenable([], genericError);

      const query = new MediaStubUpsertQuery({
        insert: jest.fn().mockReturnValue(insertChain),
      } as any);

      await expect(query.execute(stubPayload)).rejects.toThrow(DatabaseException);
    });
  });
});
