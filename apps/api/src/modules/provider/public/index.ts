/**
 * Provider Module Public API
 *
 * Exports for use by other modules.
 */

// Services
export { NormalizationService } from '../application/services/normalization.service';

// Repository tokens
export { MEDIA_WATCH_OFFERS_REPOSITORY } from '../domain/repositories/media-watch-offers.repository.interface';

// Repository interfaces
export type {
  IMediaWatchOffersRepository,
  MediaWatchOfferView,
} from '../domain/repositories/media-watch-offers.repository.interface';
