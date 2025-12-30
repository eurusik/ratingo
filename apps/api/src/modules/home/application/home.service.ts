import { Inject, Injectable, Logger } from '@nestjs/common';
import { IHeroRepository, HERO_REPOSITORY } from '../domain/repositories/hero.repository.interface';
import { HeroMediaItem } from '../../../common/types/hero-media.types';
import { MediaType } from '../../../common/enums/media-type.enum';
import { HERO_CONFIG } from '../home.constants';

/**
 * Application service for Home module endpoints.
 */
@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name);

  constructor(
    @Inject(HERO_REPOSITORY)
    private readonly heroRepository: IHeroRepository,
  ) {}

  /**
   * Returns hero items for the home page.
   *
   * @param type - Optional media type filter
   * @returns Hero media items (domain models)
   */
  async getHero(type?: MediaType): Promise<HeroMediaItem[]> {
    try {
      return await this.heroRepository.findHero(HERO_CONFIG.DEFAULT_LIMIT, type);
    } catch (error) {
      this.logger.error(`Failed to get hero items: ${error.message}`);
      return [];
    }
  }
}
