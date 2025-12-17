/**
 * Shared API types derived from @ratingo/api-contract.
 * Single source of truth for commonly used types across modules.
 */

import type { components } from '@ratingo/api-contract';

// Image types
export type ImageDto = components['schemas']['ImageDto'];

// Stats types
export type RatingoStatsDto = components['schemas']['RatingoStatsDto'];
export type ExternalRatingsDto = components['schemas']['ExternalRatingsDto'];
export type ExternalRatingItemDto = components['schemas']['ExternalRatingItemDto'];

// Card types
export type BadgeKey = NonNullable<components['schemas']['CardMetaDto']['badgeKey']>;
export type ShowProgressDto = components['schemas']['ShowProgressDto'];

// Content types
export type GenreDto = components['schemas']['GenreDto'];
export type VideoDto = components['schemas']['VideoDto'];
export type CastMemberDto = components['schemas']['CastMemberDto'];
export type CrewMemberDto = components['schemas']['CrewMemberDto'];
