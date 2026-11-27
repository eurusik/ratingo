import { Injectable, Logger } from '@nestjs/common';

import { MediaType } from '@/common/enums/media-type.enum';
import { errorMessage } from '@/common/utils/error.utils';
import {
  localizeSeasons,
  tvMazeSeasonNumbers,
} from '@/modules/ingestion/domain/episode-localization';
import { type NormalizedMedia } from '@/modules/ingestion/domain/models/normalized-media.model';
import { TmdbAdapter } from '@/modules/tmdb/public';

@Injectable()
export class EpisodeLocalizationService {
  private readonly logger = new Logger(EpisodeLocalizationService.name);

  constructor(private readonly tmdbAdapter: TmdbAdapter) {}

  async localize(media: NormalizedMedia, type: MediaType): Promise<NormalizedMedia> {
    const seasons = media.details?.seasons;
    if (type !== MediaType.SHOW || !seasons?.length) return media;

    const seasonNumbers = tvMazeSeasonNumbers(seasons);
    if (seasonNumbers.length === 0) return media;

    const { tmdbId } = media.externalIds;
    try {
      const { episodesBySeason } = await this.tmdbAdapter.getSeasonsEpisodes(tmdbId, seasonNumbers);
      return {
        ...media,
        details: { ...media.details, seasons: localizeSeasons(seasons, episodesBySeason) },
      };
    } catch (err) {
      this.logger.warn({
        message: 'Episode localization failed',
        tmdbId,
        error: errorMessage(err),
      });
      return media;
    }
  }
}
