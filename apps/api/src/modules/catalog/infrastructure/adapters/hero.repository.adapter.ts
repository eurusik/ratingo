import { Injectable } from '@nestjs/common';
import { IHeroRepository } from '../../../home/domain/repositories/hero.repository.interface';
import { HeroMediaItem } from '../../../../common/types/hero-media.types';
import { HeroMediaQuery } from '../queries/hero-media.query';
import { MediaType } from '../../../../common/enums/media-type.enum';

/**
 * Adapter that implements home module's IHeroRepository interface.
 * Delegates to HeroMediaQuery for actual data fetching.
 */
@Injectable()
export class HeroRepositoryAdapter implements IHeroRepository {
  constructor(private readonly heroMediaQuery: HeroMediaQuery) {}

  async findHero(limit: number, type?: MediaType): Promise<HeroMediaItem[]> {
    return this.heroMediaQuery.execute({ limit, type });
  }
}
