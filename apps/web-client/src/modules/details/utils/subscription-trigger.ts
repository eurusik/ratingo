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

export function getSubscriptionTrigger({
  mediaType,
  isReleased = false,
  hasStreamingProviders = false,
  showStatus,
  hasUpcomingAirDate = false,
}: GetSubscriptionTriggerParams): SubscriptionTrigger | null {
  if (mediaType === 'show') {
    // Ended/Canceled - no subscription
    if (showStatus === 'Ended' || showStatus === 'Canceled') {
      return null;
    }
    
    // Returning Series / In Production - always show subscription
    if (showStatus === 'Returning Series' || showStatus === 'In Production') {
      return 'new_season';
    }
    
    // Planned / Pilot - only if there's an upcoming air date
    if (showStatus === 'Planned' || showStatus === 'Pilot') {
      return hasUpcomingAirDate ? 'new_season' : null;
    }
    
    // Unknown status (null) - show subscription if has upcoming date, otherwise assume ongoing
    return hasUpcomingAirDate || !showStatus ? 'new_season' : null;
  }

  // Movie logic
  if (!isReleased) {
    return 'release';
  }

  if (!hasStreamingProviders) {
    return 'on_streaming';
  }

  // Movie is released and has streaming providers - no subscription needed
  return null;
}
