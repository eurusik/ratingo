import { Injectable } from '@nestjs/common';

import { type MediaType } from '../../../../common/enums/media-type.enum';
import { type HeroMediaItem } from '../../../../common/types/hero-media.types';
import { type IHeroRepository } from '../../../home/public';
import { HeroMediaQuery } from '../queries/hero-media.query';
import { WatchingNowMediaQuery } from '../queries/watching-now-media.query';

/**
 * Adapter that implements home module's IHeroRepository interface.
 * Delegates to query objects for actual data fetching.
 */
@Injectable()
export class HeroRepositoryAdapter implements IHeroRepository {
  constructor(
    private readonly heroMediaQuery: HeroMediaQuery,
    private readonly watchingNowMediaQuery: WatchingNowMediaQuery,
  ) {}

  async findHero(limit: number, type?: MediaType): Promise<HeroMediaItem[]> {
    return this.heroMediaQuery.execute({ limit, type });
  }

  async findWatchingNow(limit: number): Promise<HeroMediaItem[]> {
    return this.watchingNowMediaQuery.execute({ limit });
  }
}
