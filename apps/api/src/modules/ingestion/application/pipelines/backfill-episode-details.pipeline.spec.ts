import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';

import { formatUtcDayId } from '@/common/utils/date.util';
import { CLOCK_PORT } from '@/modules/shared/clock';
import { type StoredEpisode } from '@/modules/ingestion/domain/models/episode-details.model';
import { EPISODE_DETAILS_BACKFILL_REPOSITORY } from '@/modules/ingestion/domain/repositories/episode-details-backfill.repository.interface';
import { BACKFILL_QUEUE, IngestionJob } from '@/modules/ingestion/ingestion.constants';
import { TmdbAdapter } from '@/modules/tmdb/public';

import { TmdbEpisodeSourcesService } from '../services/tmdb-episode-sources.service';

import { BackfillEpisodeDetailsPipeline } from './backfill-episode-details.pipeline';

describe('BackfillEpisodeDetailsPipeline', () => {
  let pipeline: BackfillEpisodeDetailsPipeline;
  let repository: {
    findCandidates: jest.Mock;
    findEpisodes: jest.Mock;
    updateEpisodeDetails: jest.Mock;
    markChecked: jest.Mock;
    fillSeasonAirDatesFromEpisodes: jest.Mock;
  };
  const now = new Date('2026-11-29T01:00:00.000Z');
  let tmdbAdapter: { getSeasonsEpisodes: jest.Mock };
  let addBulk: jest.Mock;

  beforeEach(async () => {
    repository = {
      findCandidates: jest.fn().mockResolvedValue([]),
      findEpisodes: jest.fn().mockResolvedValue([]),
      updateEpisodeDetails: jest.fn().mockResolvedValue(1),
      markChecked: jest.fn().mockResolvedValue(undefined),
      fillSeasonAirDatesFromEpisodes: jest.fn().mockResolvedValue(0),
    };
    tmdbAdapter = {
      getSeasonsEpisodes: jest
        .fn()
        .mockResolvedValue({ episodesBySeason: new Map(), failedSeasons: [] }),
    };
    addBulk = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackfillEpisodeDetailsPipeline,
        TmdbEpisodeSourcesService,
        { provide: EPISODE_DETAILS_BACKFILL_REPOSITORY, useValue: repository },
        { provide: getQueueToken(BACKFILL_QUEUE), useValue: { addBulk } },
        { provide: TmdbAdapter, useValue: tmdbAdapter },
        { provide: CLOCK_PORT, useValue: { now: () => now } },
      ],
    }).compile();

    pipeline = module.get(BackfillEpisodeDetailsPipeline);
  });

  describe('dispatch', () => {
    it('queues one job per show and pages by show id', async () => {
      repository.findCandidates
        .mockResolvedValueOnce([
          { showId: 'show-a', tmdbId: 1 },
          { showId: 'show-b', tmdbId: 2 },
        ])
        .mockResolvedValueOnce([]);

      await pipeline.dispatch();

      const day = formatUtcDayId(now);
      expect(addBulk).toHaveBeenCalledWith([
        {
          name: IngestionJob.BACKFILL_EPISODE_DETAILS_ITEM,
          data: { showId: 'show-a', tmdbId: 1 },
          opts: { jobId: `backfill-episode-details_show-a_${day}` },
        },
        {
          name: IngestionJob.BACKFILL_EPISODE_DETAILS_ITEM,
          data: { showId: 'show-b', tmdbId: 2 },
          opts: { jobId: `backfill-episode-details_show-b_${day}` },
        },
      ]);
      expect(repository.findCandidates).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: 'show-b' }),
      );
    });

    it('skips shows checked within the last 28 days', async () => {
      await pipeline.dispatch();

      expect(repository.findCandidates).toHaveBeenCalledWith(
        expect.objectContaining({
          asOf: now,
          checkedBefore: new Date('2026-11-01T01:00:00.000Z'),
        }),
      );
    });

    it('still queues shows when dating seasons fails', async () => {
      repository.fillSeasonAirDatesFromEpisodes.mockRejectedValue(new Error('db down'));
      repository.findCandidates
        .mockResolvedValueOnce([{ showId: 'show-a', tmdbId: 1 }])
        .mockResolvedValueOnce([]);

      await pipeline.dispatch();

      expect(addBulk).toHaveBeenCalledTimes(1);
    });

    it('queues nothing when every show is complete', async () => {
      await pipeline.dispatch();

      expect(addBulk).not.toHaveBeenCalled();
    });

    it('dates undated seasons from their episodes before queueing shows', async () => {
      await pipeline.dispatch();

      expect(repository.fillSeasonAirDatesFromEpisodes).toHaveBeenCalledTimes(1);
    });
  });

  describe('processItem', () => {
    const complete = {
      title: 'Зима близько',
      overview: 'Опис',
      airDate: new Date('2011-04-17T00:00:00Z'),
      runtime: 60,
      stillPath: '/still.jpg',
      rating: 8,
    };
    const episode = (
      seasonNumber: number,
      number: number,
      details: Partial<StoredEpisode> = {},
    ): StoredEpisode => ({
      id: `s${seasonNumber}e${number}`,
      seasonNumber,
      number,
      ...complete,
      ...details,
    });

    it('asks TMDB only for seasons with gaps and writes only changed episodes', async () => {
      repository.findEpisodes.mockResolvedValue([
        episode(1, 1),
        episode(2, 1, { title: 'The North Remembers', overview: 'English', stillPath: null }),
        episode(2, 2, { title: 'The Night Lands', overview: 'English' }),
      ]);
      tmdbAdapter.getSeasonsEpisodes.mockResolvedValue({
        episodesBySeason: new Map([
          [
            2,
            [
              {
                number: 1,
                title: 'Північ пам’ятає',
                overview: 'Український опис',
                stillPath: '/s2e1.jpg',
              },
              { number: 2, title: 'Серія 2', overview: '' },
            ],
          ],
        ]),
        failedSeasons: [],
      });

      await pipeline.processItem({ showId: 'show-1', tmdbId: 1399 });

      expect(repository.markChecked).toHaveBeenCalledWith('show-1', now);
      expect(tmdbAdapter.getSeasonsEpisodes).toHaveBeenCalledWith(1399, [2]);
      expect(repository.updateEpisodeDetails).toHaveBeenCalledWith([
        {
          id: 's2e1',
          next: {
            ...complete,
            title: 'Північ пам’ятає',
            overview: 'Український опис',
            stillPath: '/s2e1.jpg',
          },
          previous: {
            ...complete,
            title: 'The North Remembers',
            overview: 'English',
            stillPath: null,
          },
        },
      ]);
    });

    it('saves what came back and fails the job when a TMDB batch failed, so BullMQ retries', async () => {
      repository.findEpisodes.mockResolvedValue([
        episode(1, 1, { stillPath: null }),
        episode(21, 1, { stillPath: null }),
      ]);
      tmdbAdapter.getSeasonsEpisodes.mockResolvedValue({
        episodesBySeason: new Map([[1, [{ number: 1, title: 'Серія 1', stillPath: '/s1e1.jpg' }]]]),
        failedSeasons: [21],
      });

      await expect(pipeline.processItem({ showId: 'show-1', tmdbId: 1399 })).rejects.toThrow(
        'TMDB seasons request failed',
      );
      expect(repository.markChecked).not.toHaveBeenCalled();
      expect(repository.updateEpisodeDetails).toHaveBeenCalledWith([
        expect.objectContaining({ id: 's1e1', next: { ...complete, stillPath: '/s1e1.jpg' } }),
      ]);
    });

    it('does not call TMDB when every episode is complete', async () => {
      repository.findEpisodes.mockResolvedValue([episode(1, 1)]);

      await pipeline.processItem({ showId: 'show-1', tmdbId: 1399 });

      expect(tmdbAdapter.getSeasonsEpisodes).not.toHaveBeenCalled();
      expect(repository.updateEpisodeDetails).not.toHaveBeenCalled();
      expect(repository.markChecked).toHaveBeenCalledWith('show-1', now);
    });
  });
});
