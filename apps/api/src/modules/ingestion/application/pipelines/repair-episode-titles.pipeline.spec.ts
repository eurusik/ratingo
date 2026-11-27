import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';

import { type StoredEpisode } from '@/modules/ingestion/domain/models/episode-details.model';
import { EPISODE_SCHEDULE_PORT } from '@/modules/ingestion/domain/ports/episode-schedule.port';
import { EPISODE_DETAILS_BACKFILL_REPOSITORY } from '@/modules/ingestion/domain/repositories/episode-details-backfill.repository.interface';
import {
  INGESTION_QUEUE,
  IngestionJob,
  REPAIR_EPISODE_TITLES_JOB_PRIORITY,
} from '@/modules/ingestion/ingestion.constants';
import { TmdbAdapter } from '@/modules/tmdb/public';

import { TmdbEpisodeSourcesService } from '../services/tmdb-episode-sources.service';

import { RepairEpisodeTitlesPipeline } from './repair-episode-titles.pipeline';

describe('RepairEpisodeTitlesPipeline', () => {
  let pipeline: RepairEpisodeTitlesPipeline;
  let repository: {
    findTitleRepairCandidates: jest.Mock;
    findEpisodes: jest.Mock;
    updateEpisodeDetails: jest.Mock;
  };
  let getSeasonsEpisodes: jest.Mock;
  let getEpisodesByImdbId: jest.Mock;
  let addBulk: jest.Mock;

  const episode = (number: number, title: string): StoredEpisode => ({
    id: `s5e${number}`,
    seasonNumber: 5,
    number,
    title,
    overview: null,
    airDate: null,
    runtime: null,
    stillPath: null,
    rating: null,
  });

  beforeEach(async () => {
    repository = {
      findTitleRepairCandidates: jest.fn().mockResolvedValue([]),
      findEpisodes: jest.fn().mockResolvedValue([]),
      updateEpisodeDetails: jest.fn().mockResolvedValue(1),
    };
    getSeasonsEpisodes = jest.fn();
    getEpisodesByImdbId = jest.fn().mockResolvedValue([]);
    addBulk = jest.fn().mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        RepairEpisodeTitlesPipeline,
        TmdbEpisodeSourcesService,
        { provide: EPISODE_DETAILS_BACKFILL_REPOSITORY, useValue: repository },
        { provide: getQueueToken(INGESTION_QUEUE), useValue: { addBulk } },
        { provide: TmdbAdapter, useValue: { getSeasonsEpisodes } },
        { provide: EPISODE_SCHEDULE_PORT, useValue: { getEpisodesByImdbId } },
      ],
    }).compile();
    pipeline = module.get(RepairEpisodeTitlesPipeline);
  });

  it('queues every show with Ukrainian titles behind the regular ingestion jobs', async () => {
    repository.findTitleRepairCandidates
      .mockResolvedValueOnce([{ showId: 'show-a', tmdbId: 387, imdbId: 'tt0206512' }])
      .mockResolvedValueOnce([]);

    await pipeline.dispatch();

    expect(addBulk).toHaveBeenCalledWith([
      expect.objectContaining({
        name: IngestionJob.REPAIR_EPISODE_TITLES_ITEM,
        data: { showId: 'show-a', tmdbId: 387, imdbId: 'tt0206512' },
        opts: expect.objectContaining({ priority: REPAIR_EPISODE_TITLES_JOB_PRIORITY }),
      }),
    ]);
  });

  it('re-pairs a renumbered season through TVMaze titles and overwrites the wrong title', async () => {
    repository.findEpisodes.mockResolvedValue([episode(1, 'Чекання'), episode(2, 'Чекання')]);
    getSeasonsEpisodes
      .mockResolvedValueOnce({
        episodesBySeason: new Map([
          [
            5,
            [
              { number: 1, title: 'Чекання' },
              { number: 2, title: 'Серія 2' },
              { number: 3, title: 'Серія 3' },
            ],
          ],
        ]),
        failedSeasons: [],
      })
      .mockResolvedValueOnce({
        episodesBySeason: new Map([
          [
            5,
            [
              { number: 1, title: 'Waiting' },
              { number: 2, title: 'Other' },
              { number: 3, title: 'Third' },
            ],
          ],
        ]),
        failedSeasons: [],
      });
    getEpisodesByImdbId.mockResolvedValue([
      { seasonNumber: 5, number: 1, title: 'Rise and Shine' },
      { seasonNumber: 5, number: 2, title: 'Waiting' },
    ]);

    await pipeline.processItem({ showId: 'show-a', tmdbId: 387, imdbId: 'tt0206512' });

    expect(repository.updateEpisodeDetails).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 's5e1',
        next: expect.objectContaining({ title: 'Rise and Shine' }),
      }),
    ]);
  });

  it('leaves shows alone when TMDB numbers every season the same', async () => {
    repository.findEpisodes.mockResolvedValue([episode(1, 'Пілот')]);
    getSeasonsEpisodes.mockResolvedValue({
      episodesBySeason: new Map([[5, [{ number: 1, title: 'Пілот' }]]]),
      failedSeasons: [],
    });

    await pipeline.processItem({ showId: 'show-a', tmdbId: 1, imdbId: 'tt1' });

    expect(getEpisodesByImdbId).not.toHaveBeenCalled();
    expect(repository.updateEpisodeDetails).not.toHaveBeenCalled();
  });

  it('fails the job when TMDB failed, so BullMQ retries before anything is overwritten', async () => {
    repository.findEpisodes.mockResolvedValue([episode(1, 'Пілот')]);
    getSeasonsEpisodes.mockResolvedValue({ episodesBySeason: new Map(), failedSeasons: [5] });

    await expect(
      pipeline.processItem({ showId: 'show-a', tmdbId: 1, imdbId: 'tt1' }),
    ).rejects.toThrow('TMDB seasons request failed');
    expect(repository.updateEpisodeDetails).not.toHaveBeenCalled();
  });
});
