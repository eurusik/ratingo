import { MediaUpsertQuery } from './media-upsert.query';
import { createDrizzleThenable } from '../__test__/drizzle-mock.utils';
import { MediaType } from '@/common/enums/media-type.enum';
import { DatabaseException } from '@/common/exceptions';
import { PG_ERROR_CODE, DB_CONSTRAINT } from '@/common/constants/database.constants';
import { NormalizedMedia } from '@/modules/shared/contracts';

const baseMedia: NormalizedMedia = {
  type: MediaType.MOVIE,
  externalIds: { tmdbId: 1, imdbId: 'tt1' },
  title: 'Title',
  originalTitle: 'Title',
  slug: 'title',
  overview: 'overview',
  posterPath: '/p.jpg',
  backdropPath: '/b.jpg',
  rating: 8,
  voteCount: 10,
  popularity: 100,
  releaseDate: new Date(),
  videos: null,
  credits: null,
  watchProviders: null,
  genres: [],
  details: {},
} as any;

describe('MediaUpsertQuery', () => {
  describe('execute', () => {
    const buildUpsertMock = (
      options: {
        slugOwnerTmdbId?: number | null;
        txError?: Error;
      } = {},
    ) => {
      const { slugOwnerTmdbId = null, txError } = options;
      const resolveResult = slugOwnerTmdbId !== null ? [{ tmdbId: slugOwnerTmdbId }] : [];
      const selectChain = createDrizzleThenable(resolveResult);
      const insertChain = createDrizzleThenable([{ id: 'new-id' }], undefined, [
        'onConflictDoNothing',
      ]);

      const txInternals = {
        select: jest.fn().mockReturnValue(selectChain),
        insert: jest.fn().mockReturnValue(insertChain),
        update: jest.fn().mockReturnValue(createDrizzleThenable()),
      };

      let txCallCount = 0;
      const mockDb = {
        select: jest.fn().mockReturnValue(selectChain),
        insert: jest.fn().mockReturnValue(insertChain),
        transaction: jest.fn(async (cb: any) => {
          txCallCount++;
          if (txError && txCallCount === 1) throw txError;
          return cb(txInternals);
        }),
      };

      return { mockDb, txInternals };
    };

    const buildUpsertQuery = (mockDb: any) =>
      new MediaUpsertQuery(
        mockDb,
        { syncGenres: jest.fn() } as any,
        { upsertDetails: jest.fn() } as any,
        {} as any,
      );

    it('should proactively resolve slug when taken by different tmdbId', async () => {
      const { mockDb } = buildUpsertMock({ slugOwnerTmdbId: 100 });
      const query = buildUpsertQuery(mockDb);

      const media = { ...baseMedia, slug: 'sandwich', externalIds: { tmdbId: 200, imdbId: null } };
      await query.execute(media as NormalizedMedia);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should use original slug when not taken', async () => {
      const { mockDb } = buildUpsertMock();
      const query = buildUpsertQuery(mockDb);

      await query.execute(baseMedia as NormalizedMedia);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should use original slug when taken by same tmdbId (re-sync)', async () => {
      const { mockDb } = buildUpsertMock({ slugOwnerTmdbId: baseMedia.externalIds.tmdbId });
      const query = buildUpsertQuery(mockDb);

      await query.execute(baseMedia as NormalizedMedia);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should handle race condition via catch-and-retry', async () => {
      const slugConflictError = Object.assign(new Error('unique_violation'), {
        code: PG_ERROR_CODE.UNIQUE_VIOLATION,
        constraint_name: DB_CONSTRAINT.MEDIA_TYPE_SLUG,
      });
      const { mockDb } = buildUpsertMock({ txError: slugConflictError });
      const query = buildUpsertQuery(mockDb);

      await query.execute(baseMedia as NormalizedMedia);

      expect(mockDb.transaction).toHaveBeenCalledTimes(2);
    });

    it('should throw DatabaseException when retry slug equals resolved slug', async () => {
      // Slug already has tmdbId suffix → createRetrySlug returns the same slug
      const slugConflictError = Object.assign(new Error('unique_violation'), {
        code: PG_ERROR_CODE.UNIQUE_VIOLATION,
        constraint_name: DB_CONSTRAINT.MEDIA_TYPE_SLUG,
      });
      // resolveSlug returns "title" (same tmdbId=1 owns it), but tx fails with slug collision
      const { mockDb } = buildUpsertMock({
        slugOwnerTmdbId: baseMedia.externalIds.tmdbId,
        txError: slugConflictError,
      });
      const query = buildUpsertQuery(mockDb);

      // slug="title", tmdbId=1 → retrySlug = "title-1", which differs from "title" → retry happens
      // But if slug were already "title-1", retrySlug would equal slug → DatabaseException
      const media = {
        ...baseMedia,
        slug: `title-${baseMedia.externalIds.tmdbId}`,
        externalIds: baseMedia.externalIds,
      };

      await expect(query.execute(media as NormalizedMedia)).rejects.toThrow(DatabaseException);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should throw DatabaseException on non-slug error', async () => {
      const { mockDb } = buildUpsertMock({ txError: new Error('Connection refused') });
      const query = buildUpsertQuery(mockDb);

      await expect(query.execute(baseMedia as NormalizedMedia)).rejects.toThrow(DatabaseException);
    });

    it('should throw DatabaseException when resolveSlug SELECT fails', async () => {
      const selectChain = createDrizzleThenable([], new Error('Connection refused'));
      const mockDb = {
        select: jest.fn().mockReturnValue(selectChain),
        transaction: jest.fn(),
      };
      const query = buildUpsertQuery(mockDb);

      await expect(query.execute(baseMedia as NormalizedMedia)).rejects.toThrow(DatabaseException);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });
});
