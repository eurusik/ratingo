import { Inject, Injectable, Logger } from '@nestjs/common';

import { MediaType } from '@/common/enums/media-type.enum';
import { errorMessage } from '@/common/utils/error.utils';
import { tvMazeEpisodeCounts } from '@/modules/ingestion/domain/episode-pairing';
import {
  fillSeasonAirDates,
  latestAiredDate,
  mergeTmdbEpisodeDetails,
} from '@/modules/ingestion/domain/episode-sync-merge';
import {
  type NormalizedMedia,
  type NormalizedSeason,
} from '@/modules/ingestion/domain/models/normalized-media.model';
import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';

import { TmdbEpisodeSourcesService } from './tmdb-episode-sources.service';

@Injectable()
export class EpisodeMergeService {
  private readonly logger = new Logger(EpisodeMergeService.name);

  constructor(
    private readonly tmdbEpisodeSources: TmdbEpisodeSourcesService,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
  ) {}

  async merge(media: NormalizedMedia, type: MediaType): Promise<NormalizedMedia> {
    const seasons = media.details?.seasons;
    if (type !== MediaType.SHOW || !seasons?.length) return media;

    const nowMs = this.clock.now().getTime();
    const merged = fillSeasonAirDates(
      await this.withTmdbEpisodeDetails(media.externalIds.tmdbId, seasons, nowMs),
    );
    return {
      ...media,
      details: {
        ...media.details,
        seasons: merged,
        lastAirDate: latestAiredDate(merged, nowMs) ?? media.details?.lastAirDate,
      },
    };
  }

  private async withTmdbEpisodeDetails(
    tmdbId: number,
    seasons: NormalizedSeason[],
    nowMs: number,
  ): Promise<NormalizedSeason[]> {
    const episodeCounts = tvMazeEpisodeCounts(seasons);
    if (episodeCounts.size === 0) return seasons;

    try {
      const { episodes, failedSeasons } = await this.tmdbEpisodeSources.fetch(
        tmdbId,
        episodeCounts,
      );
      if (failedSeasons.length > 0) {
        this.logger.warn({
          message: 'TMDB episode details missing for some seasons',
          tmdbId,
          failedSeasons,
        });
      }
      return mergeTmdbEpisodeDetails(seasons, episodes, nowMs);
    } catch (err) {
      this.logger.warn({
        message: 'TMDB episode details merge failed',
        tmdbId,
        error: errorMessage(err),
      });
      return seasons;
    }
  }
}
