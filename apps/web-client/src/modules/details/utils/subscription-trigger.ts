/**
 * Determines the appropriate subscription trigger for a media item.
 * 
 * For movies:
 *   - Not released yet → 'release'
 *   - Released but no streaming → 'on_streaming'  
 *   - Has streaming providers → null (no subscription needed)
 * 
 * For shows:
 *   - Returning Series / In Production → 'new_season' (always)
 *   - Planned / Pilot → 'new_season' only if hasUpcomingAirDate
 *   - Ended / Canceled → null (no new content expected)
 */

export type SubscriptionTrigger = 'release' | 'new_season' | 'on_streaming';

export type ShowStatus = 'Returning Series' | 'Planned' | 'In Production' | 'Ended' | 'Canceled' | 'Pilot' | null;

/** Reason why subscription is unavailable */
export type SubscriptionUnavailableReason = 'ended' | 'canceled' | 'no_date' | 'has_streaming' | null;

interface GetSubscriptionTriggerParams {
  mediaType: 'movie' | 'show';
  /** For movies: whether releaseDate is in the past */
  isReleased?: boolean;
  /** For movies: whether streaming providers are available */
  hasStreamingProviders?: boolean;
  /** For shows: current production status */
  showStatus?: ShowStatus;
  /** For shows: whether there's an upcoming air date (nextAirDate in future) */
  hasUpcomingAirDate?: boolean;
}

interface SubscriptionTriggerResult {
  trigger: SubscriptionTrigger | null;
  unavailableReason: SubscriptionUnavailableReason;
}

export function getSubscriptionTrigger({
  mediaType,
  isReleased = false,
  hasStreamingProviders = false,
  showStatus,
  hasUpcomingAirDate = false,
}: GetSubscriptionTriggerParams): SubscriptionTriggerResult {
  if (mediaType === 'show') {
    // Ended - no subscription
    if (showStatus === 'Ended') {
      return { trigger: null, unavailableReason: 'ended' };
    }
    
    // Canceled - no subscription
    if (showStatus === 'Canceled') {
      return { trigger: null, unavailableReason: 'canceled' };
    }
    
    // Returning Series / In Production - always show subscription
    if (showStatus === 'Returning Series' || showStatus === 'In Production') {
      return { trigger: 'new_season', unavailableReason: null };
    }
    
    // Planned / Pilot - only if there's an upcoming air date
    if (showStatus === 'Planned' || showStatus === 'Pilot') {
      return hasUpcomingAirDate 
        ? { trigger: 'new_season', unavailableReason: null }
        : { trigger: null, unavailableReason: 'no_date' };
    }
    
    // Unknown status (null) - show subscription if has upcoming date, otherwise assume ongoing
    return { trigger: 'new_season', unavailableReason: null };
  }

  // Movie logic
  if (!isReleased) {
    return { trigger: 'release', unavailableReason: null };
  }

  if (!hasStreamingProviders) {
    return { trigger: 'on_streaming', unavailableReason: null };
  }

  // Movie is released and has streaming providers - no subscription needed
  return { trigger: null, unavailableReason: 'has_streaming' };
}
