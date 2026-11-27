import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';

import { formatUtcDayId } from '@/common/utils/date.util';
import { type StoredEpisodeText } from '@/modules/ingestion/domain/models/episode-text.model';
import { EPISODE_TEXTS_BACKFILL_REPOSITORY } from '@/modules/ingestion/domain/repositories/episode-texts-backfill.repository.interface';
import { BACKFILL_QUEUE, IngestionJob } from '@/modules/ingestion/ingestion.constants';
import { TmdbAdapter } from '@/modules/tmdb/public';

import { BackfillEpisodeTextsPipeline } from './backfill-episode-texts.pipeline';

describe('BackfillEpisodeTextsPipeline', () => {
  let pipeline: BackfillEpisodeTextsPipeline;
  let repository: {
    findCandidates: jest.Mock;
    findEpisodes: jest.Mock;
    updateEpisodeTexts: jest.Mock;
  };
  let tmdbAdapter: { getSeasonsEpisodes: jest.Mock };
  let addBulk: jest.Mock;

  beforeEach(async () => {
    repository = {
      findCandidates: jest.fn().mockResolvedValue([]),
      findEpisodes: jest.fn().mockResolvedValue([]),
      updateEpisodeTexts: jest.fn().mockResolvedValue(undefined),
    };
    tmdbAdapter = {
      getSeasonsEpisodes: jest
        .fn()
        .mockResolvedValue({ episodesBySeason: new Map(), failedSeasons: [] }),
    };
    addBulk = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackfillEpisodeTextsPipeline,
        { provide: EPISODE_TEXTS_BACKFILL_REPOSITORY, useValue: repository },
        { provide: getQueueToken(BACKFILL_QUEUE), useValue: { addBulk } },
        { provide: TmdbAdapter, useValue: tmdbAdapter },
      ],
    }).compile();

    pipeline = module.get(BackfillEpisodeTextsPipeline);
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

      const day = formatUtcDayId();
      expect(addBulk).toHaveBeenCalledWith([
        {
          name: IngestionJob.BACKFILL_EPISODE_TEXTS_ITEM,
          data: { showId: 'show-a', tmdbId: 1 },
          opts: { jobId: `backfill-episode-texts_show-a_${day}` },
        },
        {
          name: IngestionJob.BACKFILL_EPISODE_TEXTS_ITEM,
          data: { showId: 'show-b', tmdbId: 2 },
          opts: { jobId: `backfill-episode-texts_show-b_${day}` },
        },
      ]);
      expect(repository.findCandidates).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: 'show-b' }),
      );
    });

    it('queues nothing when every show is translated', async () => {
      await pipeline.dispatch();

      expect(addBulk).not.toHaveBeenCalled();
    });
  });

  describe('processItem', () => {
    const episode = (
      seasonNumber: number,
      number: number,
      title: string | null,
      overview: string | null = null,
    ): StoredEpisodeText => ({
      id: `s${seasonNumber}e${number}`,
      seasonNumber,
      number,
      title,
      overview,
    });

    it('asks TMDB only for seasons with English titles and writes only changed episodes', async () => {
      repository.findEpisodes.mockResolvedValue([
        episode(1, 1, 'Зима близько', 'Опис'),
        episode(2, 1, 'The North Remembers', 'English'),
        episode(2, 2, 'The Night Lands', 'English'),
      ]);
      tmdbAdapter.getSeasonsEpisodes.mockResolvedValue({
        episodesBySeason: new Map([
          [
            2,
            [
              { number: 1, title: 'Північ пам’ятає', overview: 'Український опис' },
              { number: 2, title: 'Серія 2', overview: '' },
            ],
          ],
        ]),
        failedSeasons: [],
      });

      await pipeline.processItem({ showId: 'show-1', tmdbId: 1399 });

      expect(tmdbAdapter.getSeasonsEpisodes).toHaveBeenCalledWith(1399, [2]);
      expect(repository.updateEpisodeTexts).toHaveBeenCalledWith([
        {
          id: 's2e1',
          title: 'Північ пам’ятає',
          overview: 'Український опис',
          previousTitle: 'The North Remembers',
          previousOverview: 'English',
        },
      ]);
    });

    it('saves what came back and fails the job when a TMDB batch failed, so BullMQ retries', async () => {
      repository.findEpisodes.mockResolvedValue([
        episode(1, 1, 'Pilot', null),
        episode(21, 1, 'Late season', null),
      ]);
      tmdbAdapter.getSeasonsEpisodes.mockResolvedValue({
        episodesBySeason: new Map([[1, [{ number: 1, title: 'Пілот', overview: null }]]]),
        failedSeasons: [21],
      });

      await expect(pipeline.processItem({ showId: 'show-1', tmdbId: 1399 })).rejects.toThrow(
        'TMDB seasons request failed',
      );
      expect(repository.updateEpisodeTexts).toHaveBeenCalledWith([
        expect.objectContaining({ id: 's1e1', title: 'Пілот' }),
      ]);
    });

    it('does not call TMDB when the show is already translated', async () => {
      repository.findEpisodes.mockResolvedValue([episode(1, 1, 'Пілот')]);

      await pipeline.processItem({ showId: 'show-1', tmdbId: 1399 });

      expect(tmdbAdapter.getSeasonsEpisodes).not.toHaveBeenCalled();
      expect(repository.updateEpisodeTexts).not.toHaveBeenCalled();
    });
  });
});
