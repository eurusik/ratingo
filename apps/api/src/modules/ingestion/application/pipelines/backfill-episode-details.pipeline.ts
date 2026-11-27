import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { Queue } from 'bullmq';

import { ErrorCode } from '@/common/enums/error-code.enum';
import { ExternalApiException } from '@/common/exceptions/external-api.exception';
import { addUtcDays, formatUtcDayId } from '@/common/utils/date.util';
import { errorMessage } from '@/common/utils/error.utils';
import { EPISODE_DETAILS_CHECK_COOLDOWN_DAYS } from '@/modules/ingestion/domain/constants/episode-details.constants';
import {
  episodeDetailsUpdates,
  seasonsMissingDetails,
} from '@/modules/ingestion/domain/episode-backfill-plan';
import { storedEpisodeCounts } from '@/modules/ingestion/domain/episode-pairing';
import { buildEpisodeDetailsBackfillJobId } from '@/modules/ingestion/domain/job-ids';
import {
  EPISODE_DETAILS_BACKFILL_REPOSITORY,
  type IEpisodeDetailsBackfillRepository,
} from '@/modules/ingestion/domain/repositories/episode-details-backfill.repository.interface';
import {
  BACKFILL_EPISODE_DETAILS_BATCH_SIZE,
  BACKFILL_QUEUE,
  IngestionJob,
  TMDB_BACKFILL_RUN_CAP,
} from '@/modules/ingestion/ingestion.constants';
import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';
import { type BackfillEpisodeDetailsJobData } from '@/modules/shared/contracts';

import { TmdbEpisodeSourcesService } from '../services/tmdb-episode-sources.service';

@Injectable()
export class BackfillEpisodeDetailsPipeline {
  private readonly logger = new Logger(BackfillEpisodeDetailsPipeline.name);

  constructor(
    @Inject(EPISODE_DETAILS_BACKFILL_REPOSITORY)
    private readonly repository: IEpisodeDetailsBackfillRepository,
    @InjectQueue(BACKFILL_QUEUE)
    private readonly queue: Queue,
    private readonly tmdbEpisodeSources: TmdbEpisodeSourcesService,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
  ) {}

  async dispatch(): Promise<void> {
    const datedSeasons = await this.fillSeasonAirDates();
    const queued = await this.queueCandidates();

    this.logger.log({
      message: 'Episode details backfill dispatched',
      queued,
      datedSeasons,
      hitRunCap: queued >= TMDB_BACKFILL_RUN_CAP,
    });
  }

  private async fillSeasonAirDates(): Promise<number | null> {
    try {
      return await this.repository.fillSeasonAirDatesFromEpisodes();
    } catch (err) {
      this.logger.warn({
        message: 'Season air dates from episodes failed',
        error: errorMessage(err),
      });
      return null;
    }
  }

  private async queueCandidates(): Promise<number> {
    const asOf = this.clock.now();
    const checkedBefore = addUtcDays(asOf, -EPISODE_DETAILS_CHECK_COOLDOWN_DAYS);
    const day = formatUtcDayId(asOf);
    let cursor: string | undefined;
    let queued = 0;

    while (queued < TMDB_BACKFILL_RUN_CAP) {
      const rows = await this.repository.findCandidates({
        cursor,
        limit: Math.min(BACKFILL_EPISODE_DETAILS_BATCH_SIZE, TMDB_BACKFILL_RUN_CAP - queued),
        asOf,
        checkedBefore,
      });
      if (rows.length === 0) break;

      await this.queue.addBulk(
        rows.map((row) => ({
          name: IngestionJob.BACKFILL_EPISODE_DETAILS_ITEM,
          data: { showId: row.showId, tmdbId: row.tmdbId } satisfies BackfillEpisodeDetailsJobData,
          opts: { jobId: buildEpisodeDetailsBackfillJobId(row.showId, day) },
        })),
      );
      queued += rows.length;
      cursor = rows[rows.length - 1].showId;
    }
    return queued;
  }

  async processItem({ showId, tmdbId }: BackfillEpisodeDetailsJobData): Promise<void> {
    const now = this.clock.now();
    const nowMs = now.getTime();
    const stored = await this.repository.findEpisodes(showId);
    const seasons = seasonsMissingDetails(stored, nowMs);
    if (seasons.length === 0) {
      await this.repository.markChecked(showId, now);
      return;
    }

    const { episodes, failedSeasons } = await this.tmdbEpisodeSources.fetch(
      tmdbId,
      storedEpisodeCounts(stored, seasons),
    );
    const updates = episodeDetailsUpdates(
      stored.filter((episode) => seasons.includes(episode.seasonNumber)),
      episodes,
      nowMs,
    );
    const applied = await this.repository.updateEpisodeDetails(updates);

    if (failedSeasons.length > 0) {
      throw new ExternalApiException(
        ErrorCode.TMDB_API_ERROR,
        'TMDB seasons request failed during episode details backfill',
        { tmdbId, failedSeasons },
      );
    }

    await this.repository.markChecked(showId, now);
    this.logger.debug({
      message: 'Episode details backfilled',
      showId,
      planned: updates.length,
      applied,
    });
  }
}
