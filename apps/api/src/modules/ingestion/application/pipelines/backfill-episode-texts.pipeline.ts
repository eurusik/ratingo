import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { Queue } from 'bullmq';

import { ErrorCode } from '@/common/enums/error-code.enum';
import { ExternalApiException } from '@/common/exceptions/external-api.exception';
import { formatUtcDayId } from '@/common/utils/date.util';
import {
  episodeTextUpdates,
  seasonsMissingUkrainianTitles,
} from '@/modules/ingestion/domain/episode-localization';
import { buildEpisodeTextsBackfillJobId } from '@/modules/ingestion/domain/job-ids';
import {
  EPISODE_TEXTS_BACKFILL_REPOSITORY,
  type IEpisodeTextsBackfillRepository,
} from '@/modules/ingestion/domain/repositories/episode-texts-backfill.repository.interface';
import {
  BACKFILL_EPISODE_TEXTS_BATCH_SIZE,
  BACKFILL_QUEUE,
  IngestionJob,
  TMDB_BACKFILL_RUN_CAP,
} from '@/modules/ingestion/ingestion.constants';
import { type BackfillEpisodeTextsJobData } from '@/modules/shared/contracts';
import { TmdbAdapter } from '@/modules/tmdb/public';

@Injectable()
export class BackfillEpisodeTextsPipeline {
  private readonly logger = new Logger(BackfillEpisodeTextsPipeline.name);

  constructor(
    @Inject(EPISODE_TEXTS_BACKFILL_REPOSITORY)
    private readonly repository: IEpisodeTextsBackfillRepository,
    @InjectQueue(BACKFILL_QUEUE)
    private readonly queue: Queue,
    private readonly tmdbAdapter: TmdbAdapter,
  ) {}

  async dispatch(): Promise<void> {
    const day = formatUtcDayId();
    let cursor: string | undefined;
    let queued = 0;

    while (queued < TMDB_BACKFILL_RUN_CAP) {
      const rows = await this.repository.findCandidates({
        cursor,
        limit: Math.min(BACKFILL_EPISODE_TEXTS_BATCH_SIZE, TMDB_BACKFILL_RUN_CAP - queued),
      });
      if (rows.length === 0) break;

      await this.queue.addBulk(
        rows.map((row) => ({
          name: IngestionJob.BACKFILL_EPISODE_TEXTS_ITEM,
          data: { showId: row.showId, tmdbId: row.tmdbId } satisfies BackfillEpisodeTextsJobData,
          opts: { jobId: buildEpisodeTextsBackfillJobId(row.showId, day) },
        })),
      );
      queued += rows.length;
      cursor = rows[rows.length - 1].showId;
    }

    this.logger.log({
      message: 'Episode texts backfill dispatched',
      queued,
      hitRunCap: queued >= TMDB_BACKFILL_RUN_CAP,
    });
  }

  async processItem({ showId, tmdbId }: BackfillEpisodeTextsJobData): Promise<void> {
    const stored = await this.repository.findEpisodes(showId);
    const seasons = seasonsMissingUkrainianTitles(stored);
    if (seasons.length === 0) return;

    const { episodesBySeason, failedSeasons } = await this.tmdbAdapter.getSeasonsEpisodes(
      tmdbId,
      seasons,
    );
    const updates = episodeTextUpdates(
      stored.filter((episode) => seasons.includes(episode.seasonNumber)),
      episodesBySeason,
    );
    await this.repository.updateEpisodeTexts(updates);

    if (failedSeasons.length > 0) {
      throw new ExternalApiException(
        ErrorCode.TMDB_API_ERROR,
        'TMDB seasons request failed during episode texts backfill',
        { tmdbId, failedSeasons },
      );
    }

    this.logger.debug({ message: 'Episode texts backfilled', showId, updated: updates.length });
  }
}
