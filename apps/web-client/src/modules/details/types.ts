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
