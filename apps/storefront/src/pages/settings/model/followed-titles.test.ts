import fc from 'fast-check';
import type { Subscription, SubscriptionTrigger } from '@/shared/api';
import {
  FIRST_FOLLOWED_ROWS,
  groupFollowedTitles,
  visibleFollowedTitles,
  type FollowedTitle,
} from './followed-titles';

function subscription(mediaItemId: string, trigger: SubscriptionTrigger, title = mediaItemId) {
  return {
    id: `${mediaItemId}-${trigger}`,
    mediaItemId,
    trigger,
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    mediaSummary: {
      id: mediaItemId,
      type: 'show',
      title,
      slug: mediaItemId,
      poster: {
        thumb: 't.jpg',
        small: 's.jpg',
        medium: `${mediaItemId}.jpg`,
        large: 'l.jpg',
        original: 'o.jpg',
      },
    },
  } satisfies Subscription;
}

function followed(count: number): FollowedTitle[] {
  return Array.from({ length: count }, (_, index) => ({
    mediaItemId: `m${index}`,
    type: 'movie',
    slug: `m${index}`,
    title: `Title ${index}`,
    triggers: ['release'],
  }));
}

describe('groupFollowedTitles', () => {
  it('folds every trigger of one title into a single row, keeping the first-seen order', () => {
    const titles = groupFollowedTitles([
      subscription('bear', 'new_season'),
      subscription('dune', 'release'),
      subscription('bear', 'new_episode'),
    ]);

    expect(titles.map((title) => title.mediaItemId)).toEqual(['bear', 'dune']);
    expect(titles[0]).toMatchObject({
      imageUrl: 'bear.jpg',
      triggers: ['new_season', 'new_episode'],
    });
  });

  it('never yields more rows than distinct titles', () => {
    const triggers: SubscriptionTrigger[] = ['release', 'new_season', 'new_episode'];
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.constantFrom('a', 'b', 'c', 'd'), fc.constantFrom(...triggers))),
        (pairs) => {
          const titles = groupFollowedTitles(
            pairs.map(([id, trigger]) => subscription(id, trigger)),
          );
          expect(titles).toHaveLength(new Set(pairs.map(([id]) => id)).size);
        },
      ),
    );
  });
});

describe('visibleFollowedTitles', () => {
  it('shows the first page with a "show all" while collapsed', () => {
    const { rows, hasMore } = visibleFollowedTitles(followed(8), '', false);
    expect(rows).toHaveLength(FIRST_FOLLOWED_ROWS);
    expect(hasMore).toBe(true);
  });

  it('shows everything once expanded', () => {
    expect(visibleFollowedTitles(followed(8), '', true)).toEqual({
      rows: followed(8),
      hasMore: false,
    });
  });

  it('searches across all titles, not only the first page', () => {
    const { rows, hasMore } = visibleFollowedTitles(followed(8), 'title 7', false);
    expect(rows.map((row) => row.title)).toEqual(['Title 7']);
    expect(hasMore).toBe(false);
  });
});
