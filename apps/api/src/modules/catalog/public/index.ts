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

// Repository interfaces and tokens
export {
  IMediaRepository,
  MEDIA_REPOSITORY,
  MediaScoreData,
  MediaWithTmdbId,
  MediaScoreDataWithTmdbId,
  TrendingUpdatedItem,
} from '../domain/repositories/media.repository.interface';

export {
  IMovieRepository,
  MOVIE_REPOSITORY,
} from '../domain/repositories/movie.repository.interface';

export { IShowRepository, SHOW_REPOSITORY } from '../domain/repositories/show.repository.interface';

export {
  IGenreRepository,
  GENRE_REPOSITORY,
} from '../domain/repositories/genre.repository.interface';

export {
  IProvidersRepository,
  PROVIDERS_REPOSITORY,
} from '../domain/repositories/providers.repository.interface';
