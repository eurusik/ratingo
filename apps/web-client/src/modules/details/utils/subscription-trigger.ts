/**
 * Determines the appropriate subscription trigger for a media item.
 * 
 * For movies:
 *   - Not released yet → 'release'
 *   - Released but no streaming → 'on_streaming'  
 *   - Has streaming providers → null (no subscription needed)
 * 
 * For shows:
 *   - Returning/In Production/Planned/Pilot → 'new_season'
 *   - Ended/Canceled → null (no new content expected)
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
}

export function getSubscriptionTrigger({
  mediaType,
  isReleased = false,
  hasStreamingProviders = false,
  showStatus,
}: GetSubscriptionTriggerParams): SubscriptionTrigger | null {
  if (mediaType === 'show') {
    // Only offer subscription for shows that will have new content
    const isOngoing = !showStatus || ['Returning Series', 'Planned', 'In Production', 'Pilot'].includes(showStatus);
    return isOngoing ? 'new_season' : null;
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
