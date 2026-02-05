/**
 * Public API for catalog module.
 *
 * This is the ONLY entry point for other modules to import from catalog.
 * Do NOT import directly from domain/ or infrastructure/ folders.
 *
 * @example
 * // ✅ Correct
 * import { IMediaRepository, MEDIA_REPOSITORY } from '../catalog/public';
 *
 * // ❌ Wrong - breaks module boundaries
 * import { IMediaRepository } from '../catalog/domain/repositories/media.repository.interface';
 */

// Repository tokens (runtime values)
export { MEDIA_REPOSITORY } from '../domain/repositories/media.repository.interface';
export { MOVIE_REPOSITORY } from '../domain/repositories/movie.repository.interface';
export { SHOW_REPOSITORY } from '../domain/repositories/show.repository.interface';
export { GENRE_REPOSITORY } from '../domain/repositories/genre.repository.interface';
export { PROVIDERS_REPOSITORY } from '../domain/repositories/providers.repository.interface';

// Repository interfaces (type-only)
export type { IMediaRepository } from '../domain/repositories/media.repository.interface';
export type { IMovieRepository } from '../domain/repositories/movie.repository.interface';
export type { IShowRepository } from '../domain/repositories/show.repository.interface';
export type { IGenreRepository } from '../domain/repositories/genre.repository.interface';
export type { IProvidersRepository } from '../domain/repositories/providers.repository.interface';

// Domain types consumed by external modules
export type {
  MediaScoreDataWithTmdbId,
  SnapshotCandidate,
} from '../domain/repositories/media.repository.interface';

// Domain utilities
export { generateSlug } from '../domain/utils/slug.utils';
