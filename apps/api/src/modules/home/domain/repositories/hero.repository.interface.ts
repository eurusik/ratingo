import { type MediaType } from '../../../../common/enums/media-type.enum';
import { type HeroMediaItem } from '../../../../common/types/hero-media.types';

/**
 * Repository interface for hero media items.
 * Defined in home module, implemented by catalog module.
 */
export interface IHeroRepository {
  /**
   * Retrieves top media items for the Hero block.
   *
   * @param limit - Max items to return
   * @param type - Optional media type filter
   * @returns Hero media items
   */
  findHero(limit: number, type?: MediaType): Promise<HeroMediaItem[]>;
}

/**
 * Injection token for Hero repository.
 */
export const HERO_REPOSITORY = Symbol('HERO_REPOSITORY');
