import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../catalog/domain/repositories/media.repository.interface';
import { HeroMediaItem } from '../../catalog/domain/models/hero-media.model';
import { MediaType } from '../../../common/enums/media-type.enum';
import { HERO_CONFIG } from '../home.constants';

/**
 * Application service for Home module endpoints.
 */
@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name);

  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
  ) {}

  /**
   * Returns hero items for the home page.
   *
   * @param type - Optional media type filter
   * @returns Hero media items (domain models)
   */
  async getHero(type?: MediaType): Promise<HeroMediaItem[]> {
    try {
      return await this.mediaRepository.findHero(HERO_CONFIG.DEFAULT_LIMIT, type);
    } catch (error) {
      this.logger.error(`Failed to get hero items: ${error.message}`);
      return [];
    }
  }
}
