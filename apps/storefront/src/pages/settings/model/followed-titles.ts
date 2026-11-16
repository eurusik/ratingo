import type { MediaType, Subscription, SubscriptionTrigger } from '@/shared/api';
import { matchesSearch } from '@/shared/lib';

export interface FollowedTitle {
  mediaItemId: string;
  type: MediaType;
  slug: string;
  title: string;
  imageUrl?: string;
  triggers: SubscriptionTrigger[];
}

export function groupFollowedTitles(subscriptions: readonly Subscription[]): FollowedTitle[] {
  const titles = new Map<string, FollowedTitle>();
  for (const { mediaItemId, trigger, mediaSummary } of subscriptions) {
    const known = titles.get(mediaItemId);
    if (known) {
      if (!known.triggers.includes(trigger)) known.triggers.push(trigger);
      continue;
    }
    titles.set(mediaItemId, {
      mediaItemId,
      type: mediaSummary.type,
      slug: mediaSummary.slug,
      title: mediaSummary.title,
      imageUrl: mediaSummary.poster?.medium,
      triggers: [trigger],
    });
  }
  return [...titles.values()];
}

export function matchingFollowedTitles(
  titles: readonly FollowedTitle[],
  query: string,
): FollowedTitle[] {
  return titles.filter((title) => matchesSearch(title.title, query));
}
