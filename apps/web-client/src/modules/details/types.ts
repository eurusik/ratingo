/**
 * Re-export shared types for details module.
 * Aliases for backward compatibility.
 */

import type {
  ImageDto,
  GenreDto,
  RatingoStatsDto,
  ExternalRatingsDto,
  ExternalRatingItemDto,
  VideoDto,
  CastMemberDto,
  CrewMemberDto,
  BadgeKey,
} from '@/shared/types';

// Aliases for backward compatibility
export type ImageSet = ImageDto;
export type Genre = GenreDto;
export type Stats = RatingoStatsDto;
export type ExternalRatings = ExternalRatingsDto;
export type RatingSource = ExternalRatingItemDto;
export type Video = VideoDto;
export type CastMember = CastMemberDto;
export type CrewMember = CrewMemberDto;
export type { BadgeKey };

/**
 * Verdict types from api-contract.
 */
import type { components } from '@ratingo/api-contract';

export type MovieVerdictDto = components['schemas']['MovieVerdictDto'];
export type ShowVerdictDto = components['schemas']['ShowVerdictDto'];
export type VerdictHintKey = MovieVerdictDto['hintKey'];

// Re-export VerdictType from data-verdict-server for backward compatibility
export type { VerdictType } from './components/data-verdict-server';

// Alias for backward compatibility
export type MovieVerdict = MovieVerdictDto;

/**
 * Movie verdict message keys.
 * Derived from API but kept as explicit union for i18n type safety.
 */
export type MovieVerdictMessageKey =
  | 'upcomingHit'
  | 'justReleased'
  | 'nowStreaming'
  | 'criticsLoved'
  | 'trendingNow'
  | 'strongRatings'
  | 'decentRatings'
  | 'risingHype'
  | 'comingToStreaming'
  | 'mixedReviews'
  | 'belowAverage'
  | 'poorRatings'
  | 'earlyReviews'
  | 'steadyInterest'
  | 'classicChoice'
  | 'timelessFavorite';
