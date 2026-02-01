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

  /**
   * Retrieves top FRESH media items for "Watching Now" (Зараз дивляться) block.
   *
   * Unlike Hero, this uses strict freshness criteria:
   * - Movies: released within last 45 days
   * - Shows: last episode within 21 days OR has next episode scheduled
   * - Must have watchers_count > 0 (live watchers)
   *
   * Sorted by watchers_count DESC (most watched first).
   *
   * @param limit - Max items to return (typically 3)
   * @returns Fresh, actively watched media items
   */
  findWatchingNow(limit: number): Promise<HeroMediaItem[]>;
}

/**
 * Injection token for Hero repository.
 */
export const HERO_REPOSITORY = Symbol('HERO_REPOSITORY');
