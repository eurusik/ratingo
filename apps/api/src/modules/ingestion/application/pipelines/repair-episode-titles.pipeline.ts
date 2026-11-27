import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { Queue } from 'bullmq';

import { ErrorCode } from '@/common/enums/error-code.enum';
import { ExternalApiException } from '@/common/exceptions/external-api.exception';
import { formatUtcDayId } from '@/common/utils/date.util';
import {
  renumberedTitleRepairs,
  seasonsWithUkrainianTitles,
} from '@/modules/ingestion/domain/episode-backfill-plan';
import { renumberedSeasons, storedEpisodeCounts } from '@/modules/ingestion/domain/episode-pairing';
import { buildEpisodeTitlesRepairJobId } from '@/modules/ingestion/domain/job-ids';
import {
  EPISODE_SCHEDULE_PORT,
  type EpisodeSchedulePort,
} from '@/modules/ingestion/domain/ports/episode-schedule.port';
import {
  EPISODE_DETAILS_BACKFILL_REPOSITORY,
  type IEpisodeDetailsBackfillRepository,
} from '@/modules/ingestion/domain/repositories/episode-details-backfill.repository.interface';
import {
  BACKFILL_EPISODE_DETAILS_BATCH_SIZE,
  INGESTION_QUEUE,
  IngestionJob,
  REPAIR_EPISODE_TITLES_JOB_PRIORITY,
} from '@/modules/ingestion/ingestion.constants';
import { type RepairEpisodeTitlesJobData } from '@/modules/shared/contracts';

import { TmdbEpisodeSourcesService } from '../services/tmdb-episode-sources.service';

@Injectable()
export class RepairEpisodeTitlesPipeline {
  private readonly logger = new Logger(RepairEpisodeTitlesPipeline.name);

  constructor(
    @Inject(EPISODE_DETAILS_BACKFILL_REPOSITORY)
    private readonly repository: IEpisodeDetailsBackfillRepository,
    @InjectQueue(INGESTION_QUEUE)
    private readonly queue: Queue,
    private readonly tmdbEpisodeSources: TmdbEpisodeSourcesService,
    @Inject(EPISODE_SCHEDULE_PORT)
    private readonly episodeSchedule: EpisodeSchedulePort,
  ) {}

  async dispatch(): Promise<void> {
    const day = formatUtcDayId();
    let cursor: string | undefined;
    let queued = 0;

    for (;;) {
      const rows = await this.repository.findTitleRepairCandidates({
        cursor,
        limit: BACKFILL_EPISODE_DETAILS_BATCH_SIZE,
      });
      if (rows.length === 0) break;

      await this.queue.addBulk(
        rows.map((row) => ({
          name: IngestionJob.REPAIR_EPISODE_TITLES_ITEM,
          data: {
            showId: row.showId,
            tmdbId: row.tmdbId,
            imdbId: row.imdbId,
          } satisfies RepairEpisodeTitlesJobData,
          opts: {
            jobId: buildEpisodeTitlesRepairJobId(row.showId, day),
            priority: REPAIR_EPISODE_TITLES_JOB_PRIORITY,
          },
        })),
      );
      queued += rows.length;
      cursor = rows[rows.length - 1].showId;
    }

    this.logger.log({ message: 'Episode titles repair dispatched', queued });
  }

  async processItem({ showId, tmdbId, imdbId }: RepairEpisodeTitlesJobData): Promise<void> {
    const stored = await this.repository.findEpisodes(showId);
    const episodeCounts = storedEpisodeCounts(stored, seasonsWithUkrainianTitles(stored));
    if (episodeCounts.size === 0) return;

    const { episodes, failedSeasons } = await this.tmdbEpisodeSources.fetch(tmdbId, episodeCounts);
    if (failedSeasons.length > 0) {
      throw new ExternalApiException(
        ErrorCode.TMDB_API_ERROR,
        'TMDB seasons request failed during episode titles repair',
        { tmdbId, failedSeasons },
      );
    }

    const renumbered = renumberedSeasons(episodeCounts, episodes.localized);
    if (renumbered.length === 0) return;

    const tvMazeEpisodes = await this.episodeSchedule.getEpisodesByImdbId(imdbId);
    if (tvMazeEpisodes.length === 0) {
      this.logger.log({ message: 'Episode titles repair skipped without TVMaze', showId });
      return;
    }

    const repairs = renumberedTitleRepairs(stored, tvMazeEpisodes, episodes, renumbered);
    if (repairs.length === 0) return;
    const applied = await this.repository.updateEpisodeDetails(repairs);
    this.logger.log({
      message: 'Episode titles repaired',
      showId,
      renumberedSeasons: renumbered.length,
      planned: repairs.length,
      applied,
    });
  }
}
