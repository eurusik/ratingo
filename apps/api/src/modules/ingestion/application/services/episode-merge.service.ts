import { Injectable, Logger } from '@nestjs/common';

import { MediaType } from '@/common/enums/media-type.enum';
import { errorMessage } from '@/common/utils/error.utils';
import {
  fillSeasonAirDates,
  mergeTmdbEpisodeDetails,
  tvMazeEpisodeCounts,
} from '@/modules/ingestion/domain/episode-merge';
import {
  type NormalizedMedia,
  type NormalizedSeason,
} from '@/modules/ingestion/domain/models/normalized-media.model';

import { TmdbEpisodeSourcesService } from './tmdb-episode-sources.service';

@Injectable()
export class EpisodeMergeService {
  private readonly logger = new Logger(EpisodeMergeService.name);

  constructor(private readonly tmdbEpisodeSources: TmdbEpisodeSourcesService) {}

  async merge(media: NormalizedMedia, type: MediaType): Promise<NormalizedMedia> {
    const seasons = media.details?.seasons;
    if (type !== MediaType.SHOW || !seasons?.length) return media;

    const merged = await this.withTmdbEpisodeDetails(media.externalIds.tmdbId, seasons);
    return {
      ...media,
      details: { ...media.details, seasons: fillSeasonAirDates(merged) },
    };
  }

  private async withTmdbEpisodeDetails(
    tmdbId: number,
    seasons: NormalizedSeason[],
  ): Promise<NormalizedSeason[]> {
    const episodeCounts = tvMazeEpisodeCounts(seasons);
    if (episodeCounts.size === 0) return seasons;

    try {
      const { episodes } = await this.tmdbEpisodeSources.fetch(tmdbId, episodeCounts);
      return mergeTmdbEpisodeDetails(seasons, episodes);
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
