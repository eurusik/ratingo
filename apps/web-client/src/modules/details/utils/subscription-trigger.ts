/**
 * Determines the appropriate subscription trigger for a media item.
 * 
 * For movies:
 *   - Not released yet → 'release'
 *   - Released but no streaming → 'on_streaming'  
 *   - Has streaming providers → null (no subscription needed)
 * 
 * For shows: always 'new_season'
 */

export type SubscriptionTrigger = 'release' | 'new_season' | 'on_streaming';

interface GetSubscriptionTriggerParams {
  mediaType: 'movie' | 'show';
  isReleased?: boolean;
  hasStreamingProviders?: boolean;
}

export function getSubscriptionTrigger({
  mediaType,
  isReleased = false,
  hasStreamingProviders = false,
}: GetSubscriptionTriggerParams): SubscriptionTrigger | null {
  if (mediaType === 'show') {
    return 'new_season';
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
