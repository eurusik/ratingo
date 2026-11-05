import { Test, TestingModule } from '@nestjs/testing';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { DATABASE_CONNECTION } from '../../../../database/database.module';

import { MediaBackfillRepository } from './media-backfill.repository';

function buildDbMock(selectRows: Array<Record<string, unknown>> = []) {
  const limit = jest.fn().mockResolvedValue(selectRows);
  const orderBy = jest.fn().mockReturnValue({ limit });
  const where = jest.fn().mockReturnValue({ orderBy, limit });
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });

  const updateWhere = jest.fn().mockResolvedValue(undefined);
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });

  return { db: { select, update }, spies: { select, limit, orderBy, update, updateSet } };
}

describe('MediaBackfillRepository', () => {
  const setup = async (selectRows: Array<Record<string, unknown>> = []) => {
    const { db, spies } = buildDbMock(selectRows);
    const module: TestingModule = await Test.createTestingModule({
      providers: [MediaBackfillRepository, { provide: DATABASE_CONNECTION, useValue: db }],
    }).compile();
    return { repository: module.get(MediaBackfillRepository), spies };
  };

  describe('findRtBackfillCandidates', () => {
    it('applies the requested limit and orders by id', async () => {
      const rows = [{ id: 'media-1', tmdbId: 1, type: MediaType.MOVIE }];
      const { repository, spies } = await setup(rows);

      const result = await repository.findRtBackfillCandidates(new Date(), 'cursor-1', 250);

      expect(result).toEqual(rows);
      expect(spies.orderBy).toHaveBeenCalledTimes(1);
      expect(spies.limit).toHaveBeenCalledWith(250);
    });
  });

  describe('findRtFetchedAt', () => {
    it('returns the stored rtFetchedAt', async () => {
      const fetchedAt = new Date();
      const { repository } = await setup([{ rtFetchedAt: fetchedAt }]);

      await expect(repository.findRtFetchedAt('media-1', 101)).resolves.toBe(fetchedAt);
    });

    it('returns null when the row is missing', async () => {
      const { repository } = await setup([]);

      await expect(repository.findRtFetchedAt('media-1', 101)).resolves.toBeNull();
    });
  });

  describe('markRtFetched', () => {
    it('writes both critics and audience when both are present', async () => {
      const { repository, spies } = await setup();

      await repository.markRtFetched('media-1', 101, {
        rottenTomatoesCritics: 78,
        rottenTomatoesAudience: 76,
      });

      expect(spies.updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ ratingRottenTomatoes: 78, ratingRottenTomatoesAudience: 76 }),
      );
    });

    it('writes only critics when audience is missing', async () => {
      const { repository, spies } = await setup();

      await repository.markRtFetched('media-1', 101, {
        rottenTomatoesCritics: 78,
        rottenTomatoesAudience: null,
      });

      const payload = spies.updateSet.mock.calls[0][0];
      expect(payload).toHaveProperty('ratingRottenTomatoes', 78);
      expect(payload).not.toHaveProperty('ratingRottenTomatoesAudience');
    });

    it('writes only audience when critics is missing', async () => {
      const { repository, spies } = await setup();

      await repository.markRtFetched('media-1', 101, {
        rottenTomatoesCritics: null,
        rottenTomatoesAudience: 80,
      });

      const payload = spies.updateSet.mock.calls[0][0];
      expect(payload).toHaveProperty('ratingRottenTomatoesAudience', 80);
      expect(payload).not.toHaveProperty('ratingRottenTomatoes');
    });

    it('stamps only rtFetchedAt when no ratings were returned', async () => {
      const { repository, spies } = await setup();

      await repository.markRtFetched('media-1', 101, {
        rottenTomatoesCritics: null,
        rottenTomatoesAudience: null,
      });

      const payload = spies.updateSet.mock.calls[0][0];
      expect(payload.rtFetchedAt).toBeInstanceOf(Date);
      expect(payload).not.toHaveProperty('ratingRottenTomatoes');
      expect(payload).not.toHaveProperty('ratingRottenTomatoesAudience');
    });

    it('does not bump updatedAt when only rtFetchedAt changed', async () => {
      const { repository, spies } = await setup();

      await repository.markRtFetched('media-1', 101, {
        rottenTomatoesCritics: null,
        rottenTomatoesAudience: null,
      });

      expect(spies.updateSet.mock.calls[0][0]).not.toHaveProperty('updatedAt');
    });

    it('bumps updatedAt when rating data was written', async () => {
      const { repository, spies } = await setup();

      await repository.markRtFetched('media-1', 101, {
        rottenTomatoesCritics: 78,
        rottenTomatoesAudience: 76,
      });

      expect(spies.updateSet.mock.calls[0][0].updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('setShowImdbId', () => {
    it('updates the imdbId', async () => {
      const { repository, spies } = await setup();

      await repository.setShowImdbId(42, 'tt0000042');

      expect(spies.updateSet).toHaveBeenCalledWith({ imdbId: 'tt0000042' });
    });
  });
});
