import fc from 'fast-check';
import type { Subscription, SubscriptionTrigger } from '@/shared/api';
import { groupFollowedTitles, matchingFollowedTitles, type FollowedTitle } from './followed-titles';

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

describe('matchingFollowedTitles', () => {
  it('keeps every title while the search is empty', () => {
    expect(matchingFollowedTitles(followed(30), '  ')).toHaveLength(30);
  });

  it('searches across the whole list', () => {
    expect(matchingFollowedTitles(followed(30), 'title 27').map((row) => row.title)).toEqual([
      'Title 27',
    ]);
  });
});
