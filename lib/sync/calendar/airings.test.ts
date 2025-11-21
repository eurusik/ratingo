import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getExistingAiring, updateAiring, insertAiring } from './airings';
import { db } from '@/db';
import { showAirings } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { AiringData } from './types';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn(),
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const original = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...original,
    eq: vi.fn((field, value) => ({ field: field.name, value, op: 'eq' })),
    isNull: vi.fn((field) => ({ field: field.name, op: 'isNull' })),
    and: vi.fn((...args) => args),
  };
});

describe('calendar/airings', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.mocked(db.select).mockClear().mockReturnThis();
    vi.mocked(db.from).mockClear().mockReturnThis();
    vi.mocked(db.where).mockClear().mockReturnThis();
    vi.mocked(db.limit).mockClear();
    vi.mocked(db.update).mockClear().mockReturnThis();
    vi.mocked(db.set).mockClear().mockReturnThis();
    vi.mocked(db.insert).mockClear().mockReturnThis();
    vi.mocked(db.values).mockClear();
    vi.mocked(and).mockClear();
  });

  describe('getExistingAiring', () => {
    it('should return the airing ID if found', async () => {
      const mockAiring = { id: 123 };
      vi.mocked(db.limit).mockResolvedValue([mockAiring]);

      const result = await getExistingAiring(1, 2, 3);

      expect(result).toEqual(mockAiring);
      expect(db.select).toHaveBeenCalledWith({ id: showAirings.id });
      expect(db.from).toHaveBeenCalledWith(showAirings);
      expect(db.where).toHaveBeenCalled();
      expect(db.limit).toHaveBeenCalledWith(1);
    });

    it('should return null if no airing is found', async () => {
      vi.mocked(db.limit).mockResolvedValue([]);
      const result = await getExistingAiring(1, 2, 3);
      expect(result).toBeNull();
    });

    it('should build conditions correctly with null season and episode', async () => {
      await getExistingAiring(10, null, null);
      expect(vi.mocked(and)).toHaveBeenCalledWith(
        expect.objectContaining({ field: 'tmdb_id', value: 10 }),
        expect.objectContaining({ field: 'season', op: 'isNull' }),
        expect.objectContaining({ field: 'episode', op: 'isNull' })
      );
    });
  });

  describe('updateAiring', () => {
    it('should call update with the correct data', async () => {
      const airingId = 123;
      const airingData: AiringData = {
        showId: 1,
        tmdbId: 10,
        traktId: 100,
        title: 's',
        episodeTitle: 'e',
        season: 1,
        episode: 1,
        airDate: '2023-01-01',
        network: 'n',
        type: 'episode',
      };

      await updateAiring(airingId, airingData);

      expect(db.update).toHaveBeenCalledWith(showAirings);
      expect(db.set).toHaveBeenCalledWith(
        expect.objectContaining({
          showId: airingData.showId,
          traktId: airingData.traktId,
          title: airingData.title,
          airDate: airingData.airDate,
          updatedAt: expect.any(Date),
        })
      );
      expect(db.where).toHaveBeenCalledWith(expect.objectContaining({ value: airingId }));
    });
  });

  describe('insertAiring', () => {
    it('should call insert with the correct data', async () => {
      const airingData: AiringData = {
        showId: 1,
        tmdbId: 10,
        traktId: 100,
        title: 's',
        episodeTitle: 'e',
        season: 1,
        episode: 1,
        airDate: '2023-01-01',
        network: 'n',
        type: 'episode',
      };

      await insertAiring(airingData);

      expect(db.insert).toHaveBeenCalledWith(showAirings);
      expect(db.values).toHaveBeenCalledWith(airingData);
    });
  });
});
