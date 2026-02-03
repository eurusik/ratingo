import { type ReleaseStatus } from '../../../../common/enums/release-status.enum';
import type { CardMeta } from '../../../shared/cards/domain/card.types';
import type { MovieVerdict } from '../../../shared/verdict/domain/movie-verdict.types';
import type { UserState } from '../ports/user-state-provider.port';
import type { MovieDetails } from '../repositories/movie.repository.interface';

/**
 * Re-export MovieDetails from repository interface for backward compatibility.
 * MovieDetailsResult is an alias for MovieDetails.
 */
export type { MovieDetails as MovieDetailsResult } from '../repositories/movie.repository.interface';

/**
 * Enriched movie details with user state, card metadata, and verdict.
 * This is the result type for movie details queries.
 */
export interface EnrichedMovieDetails extends MovieDetails {
  userState: UserState | null;
  card: CardMeta | null;
  releaseStatus: ReleaseStatus;
  verdict: MovieVerdict;
}
