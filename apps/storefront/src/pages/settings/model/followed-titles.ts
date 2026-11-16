import type { MediaType, Subscription, SubscriptionTrigger } from '@/shared/api';
import { isSearchQuery, matchesSearch } from '@/shared/lib';

export const FIRST_FOLLOWED_ROWS = 5;

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

export interface VisibleFollowedTitles {
  rows: FollowedTitle[];
  hasMore: boolean;
}

export function visibleFollowedTitles(
  titles: readonly FollowedTitle[],
  query: string,
  isExpanded: boolean,
): VisibleFollowedTitles {
  if (isSearchQuery(query)) {
    return { rows: titles.filter((title) => matchesSearch(title.title, query)), hasMore: false };
  }
  if (isExpanded) return { rows: [...titles], hasMore: false };
  return {
    rows: titles.slice(0, FIRST_FOLLOWED_ROWS),
    hasMore: titles.length > FIRST_FOLLOWED_ROWS,
  };
}
