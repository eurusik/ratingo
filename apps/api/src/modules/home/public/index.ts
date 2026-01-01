/**
 * Public API for home module.
 *
 * @example
 * // ✅ Correct
 * import { IHeroRepository, HERO_REPOSITORY } from '../home/public';
 *
 * // ❌ Wrong
 * import { IHeroRepository } from '../home/domain/repositories/hero.repository.interface';
 */

export { IHeroRepository, HERO_REPOSITORY } from '../domain/repositories/hero.repository.interface';
