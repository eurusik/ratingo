import { Injectable } from '@nestjs/common';

import { type MediaType } from '../../../../common/enums/media-type.enum';
import { type HeroMediaItem } from '../../../../common/types/hero-media.types';
import { type IHeroRepository } from '../../../home/public';
import { type HeroMediaQuery } from '../queries/hero-media.query';

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
