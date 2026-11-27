import { Inject, Injectable, Logger } from '@nestjs/common';

import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { MediaType } from '@/common/enums/media-type.enum';
import { errorMessage } from '@/common/utils/error.utils';
import { type IMediaRepository, MEDIA_REPOSITORY } from '@/modules/catalog/public';
import { EpisodeScheduleUnavailableError } from '@/modules/ingestion/domain/errors/episode-schedule-unavailable.error';
import { type NormalizedMedia } from '@/modules/ingestion/domain/models/normalized-media.model';
import { keepStoredEpisodeSchedule } from '@/modules/ingestion/domain/stored-episode-schedule';

import { TvMazeEnrichmentService } from './tvmaze-enrichment.service';

@Injectable()
export class TvMazeScheduleService {
  private readonly logger = new Logger(TvMazeScheduleService.name);

  constructor(
    private readonly tvMazeEnrichment: TvMazeEnrichmentService,
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
  ) {}

  async enrich(media: NormalizedMedia): Promise<NormalizedMedia> {
    try {
      return await this.tvMazeEnrichment.enrich(media);
    } catch (err) {
      const hasStoredSchedule = await this.hasStoredSchedule(media.externalIds.tmdbId);
      const unavailable = err instanceof EpisodeScheduleUnavailableError;
      this.logger.warn({
        message: unavailable ? 'TVMaze unavailable' : 'TVMaze enrichment failed',
        tmdbId: media.externalIds.tmdbId,
        statusCode: unavailable ? err.statusCode : undefined,
        keptStoredEpisodes: hasStoredSchedule,
        error: errorMessage(err),
      });
      return hasStoredSchedule ? keepStoredEpisodeSchedule(media) : media;
    }
  }

  private async hasStoredSchedule(tmdbId: number): Promise<boolean> {
    try {
      const stored = await this.mediaRepository.findByTmdbId(tmdbId, MediaType.SHOW);
      return stored?.ingestionStatus === IngestionStatus.READY;
    } catch {
      return true;
    }
  }
}
