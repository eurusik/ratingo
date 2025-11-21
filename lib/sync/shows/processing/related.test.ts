import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureRelatedShows, linkRelated } from './related';

vi.mock('./api', () => ({
  createShowApiClients: vi.fn(() => ({
    getShowDetails: vi.fn(async (id: number) => ({ id, name: 'Rel', vote_average: 7 }) as any),
    getShowTranslation: vi.fn(async () => ({ titleUk: 'Rel UK' }) as any),
    getWatchProviders: vi.fn(
      async (_id: number, region: string) => [{ id: 1, region, name: 'P' }] as any
    ),
    getExternalIds: vi.fn(async () => ({ imdb_id: 'tt001' }) as any),
    getOmdbRatings: vi.fn(async () => ({ imdbRating: 7, imdbVotes: 1000, metacritic: 75 }) as any),
  })),
}));

vi.mock('./processing', () => ({
  mergeProviders: vi.fn((a: any[], b: any[]) => [...a, ...b]),
  prepareRelatedShowData: vi.fn((details: any, uk: any) => ({
    tmdbId: details.id,
    title: details.name,
    titleUk: uk?.titleUk || null,
  })),
}));

const makeTx = () => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
});

describe('shows/processing/related', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ensureRelatedShows додає відсутні шоу (до 12) і повертає кількість', async () => {
    const tx = makeTx();
    (tx.limit as any).mockResolvedValueOnce([{ tmdbId: 100 }] as any);
    const ctx = { onRetryLabel: () => vi.fn() } as any;
    const inserted = await ensureRelatedShows(tx as any, [100, 101, 102], ctx);
    expect(inserted).toBe(2);
    expect(tx.insert).toHaveBeenCalledTimes(2);
  });

  it('linkRelated створює посилання лише для існуючих і не дублює', async () => {
    const tx = makeTx();
    const selectShowsBuilder: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { id: 10, tmdbId: 100 },
        { id: 11, tmdbId: 101 },
      ]),
    };
    const selectLinksBuilder: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ relatedShowId: 11 }]),
    };
    vi.mocked(tx.select).mockReturnValueOnce(selectShowsBuilder);
    vi.mocked(tx.select).mockReturnValueOnce(selectLinksBuilder);
    const added = await linkRelated(tx as any, 1, [100, 101, 999], 'tmdb');
    expect(added).toBe(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);
    expect(tx.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ showId: 1, relatedShowId: 10, source: 'tmdb', rank: 1 }),
      ])
    );
  });
});
