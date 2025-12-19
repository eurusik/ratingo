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
export type ListContext = NonNullable<components['schemas']['CardMetaDto']['listContext']>;
export type PrimaryCta = components['schemas']['CardMetaDto']['primaryCta'];
export type ContinuePointDto = components['schemas']['ContinuePointDto'];
export type ShowProgressDto = components['schemas']['ShowProgressDto'];

/** Primary CTA constants - use instead of magic strings */
export const PRIMARY_CTA = {
  SAVE: 'SAVE',
  CONTINUE: 'CONTINUE',
  OPEN: 'OPEN',
} as const satisfies Record<string, NonNullable<PrimaryCta>>;

// Content types
export type GenreDto = components['schemas']['GenreDto'];
export type VideoDto = components['schemas']['VideoDto'];
export type CastMemberDto = components['schemas']['CastMemberDto'];
export type CrewMemberDto = components['schemas']['CrewMemberDto'];

// Media types
export type MediaType = 'movie' | 'show';

// Show status (from ShowResponseDto) - includes null for unknown status
export type ShowStatus = components['schemas']['ShowResponseDto']['status'];

// Subscription types (from SubscribeDto)
export type SubscriptionTrigger = components['schemas']['SubscribeDto']['trigger'];

/** Reason why subscription is unavailable (null when subscription is available) */
export type SubscriptionUnavailableReason = 'ended' | 'canceled' | 'no_date' | 'already_available' | null;
