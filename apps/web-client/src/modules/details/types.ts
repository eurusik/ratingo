/**
 * Shared types for details pages.
 * Most types are now imported from @ratingo/api-contract to avoid duplication.
 */

import type { components } from '@ratingo/api-contract';

// Re-export commonly used types from API contract
export type ImageSet = components['schemas']['ImageDto'];
export type Genre = components['schemas']['GenreDto'];
export type Stats = components['schemas']['RatingoStatsDto'];
export type ExternalRatings = components['schemas']['ExternalRatingsDto'];
export type RatingSource = components['schemas']['ExternalRatingItemDto'];
export type Video = components['schemas']['VideoDto'];
export type CastMember = components['schemas']['CastMemberDto'];
export type CrewMember = components['schemas']['CrewMemberDto'];

// Badge key type - derived from CardMetaDto
export type BadgeKey = NonNullable<components['schemas']['CardMetaDto']['badgeKey']>
