import { Inject, Injectable, Logger } from '@nestjs/common';

import { type MediaType } from '../../../../common/enums/media-type.enum';
import { type IMediaRepository, MEDIA_REPOSITORY } from '../../../catalog/public';
import { WEB_PAGE_CACHE_PORT, type WebPageCachePort } from '../../domain/ports/web-page-cache.port';

@Injectable()
export class MediaPageCacheService {
  private readonly logger = new Logger(MediaPageCacheService.name);

  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
    @Inject(WEB_PAGE_CACHE_PORT)
    private readonly webPageCache: WebPageCachePort,
  ) {}

  async invalidateAfterSync(tmdbId: number, type: MediaType): Promise<void> {
    try {
      const media = await this.mediaRepository.findByTmdbId(tmdbId, type);
      if (!media) {
        this.logger.warn(`Skipped web page invalidation for ${type} ${tmdbId}: media not found`);
        return;
      }

      await this.webPageCache.invalidateMediaPage(type, media.slug);
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate web page for ${type} ${tmdbId}: ${(error as Error).message}`,
      );
    }
  }
}
