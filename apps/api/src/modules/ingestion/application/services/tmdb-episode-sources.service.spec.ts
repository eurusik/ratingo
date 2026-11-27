import { Test } from '@nestjs/testing';

import { TmdbAdapter } from '@/modules/tmdb/public';

import { TmdbEpisodeSourcesService } from './tmdb-episode-sources.service';

describe('TmdbEpisodeSourcesService', () => {
  let service: TmdbEpisodeSourcesService;
  let getSeasonsEpisodes: jest.Mock;

  const episodes = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ number: index + 1, title: 'Серія' }));

  beforeEach(async () => {
    getSeasonsEpisodes = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        TmdbEpisodeSourcesService,
        { provide: TmdbAdapter, useValue: { getSeasonsEpisodes } },
      ],
    }).compile();
    service = module.get(TmdbEpisodeSourcesService);
  });

  it('asks for English titles only for seasons TMDB counts differently', async () => {
    const english = new Map([[3, episodes(40)]]);
    getSeasonsEpisodes
      .mockResolvedValueOnce({
        episodesBySeason: new Map([
          [1, episodes(41)],
          [3, episodes(40)],
        ]),
        failedSeasons: [5],
      })
      .mockResolvedValueOnce({ episodesBySeason: english, failedSeasons: [] });

    const sources = await service.fetch(
      387,
      new Map([
        [1, 41],
        [3, 37],
        [5, 39],
      ]),
    );

    expect(getSeasonsEpisodes).toHaveBeenNthCalledWith(1, 387, [1, 3, 5]);
    expect(getSeasonsEpisodes).toHaveBeenNthCalledWith(2, 387, [3], 'en-US');
    expect(sources.episodes.english).toBe(english);
    expect(sources.failedSeasons).toEqual([5]);
  });

  it('makes one request when every season is numbered the same', async () => {
    getSeasonsEpisodes.mockResolvedValue({
      episodesBySeason: new Map([[1, episodes(2)]]),
      failedSeasons: [],
    });

    const sources = await service.fetch(1399, new Map([[1, 2]]));

    expect(getSeasonsEpisodes).toHaveBeenCalledTimes(1);
    expect(sources.episodes.english.size).toBe(0);
  });

  it('reports failed English seasons so the backfill retries', async () => {
    getSeasonsEpisodes
      .mockResolvedValueOnce({ episodesBySeason: new Map([[3, episodes(40)]]), failedSeasons: [] })
      .mockResolvedValueOnce({ episodesBySeason: new Map(), failedSeasons: [3] });

    const sources = await service.fetch(387, new Map([[3, 37]]));

    expect(sources.failedSeasons).toEqual([3]);
  });
});
