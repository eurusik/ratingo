import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../catalog/domain/repositories/media.repository.interface';
import { HeroItemDto } from '../presentation/dtos/hero-item.dto';
import { MediaType } from '../../../common/enums/media-type.enum';

@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name);

  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository
  ) {}

  async getHero(type?: MediaType): Promise<HeroItemDto[]> {
    try {
      // Get top items from repository
      // We ask for strict limit of 3 for now
      const items = await this.mediaRepository.findHero(3, type);

      return items as HeroItemDto[];
    } catch (error) {
      this.logger.error(`Failed to get hero items: ${error.message}`);
      return [];
    }
  }
}
