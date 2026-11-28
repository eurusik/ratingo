import fc from 'fast-check';
import type { Episode } from './season';
import { isOverviewSpoiler } from './episode-overview';

const episode = (seasonNumber: number, number: number, id = `s${seasonNumber}e${number}`) =>
  ({ id, seasonNumber, number }) satisfies Episode;

const NEXT = episode(2, 3);

describe('isOverviewSpoiler', () => {
  it('hides the overview of an unwatched episode after the next one to watch', () => {
    const watched = new Set(['s1e1']);

    expect(isOverviewSpoiler(episode(2, 4), watched, NEXT)).toBe(true);
    expect(isOverviewSpoiler(episode(3, 1), watched, NEXT)).toBe(true);
  });

  it('shows the next episode and everything before it', () => {
    const watched = new Set(['s1e1']);

    expect(isOverviewSpoiler(NEXT, watched, NEXT)).toBe(false);
    expect(isOverviewSpoiler(episode(2, 2), watched, NEXT)).toBe(false);
    expect(isOverviewSpoiler(episode(1, 9), watched, NEXT)).toBe(false);
  });

  it('shows a watched episode even when it comes after the next one', () => {
    expect(isOverviewSpoiler(episode(4, 1), new Set(['s4e1']), NEXT)).toBe(false);
  });

  it('hides nothing before the viewer has watched anything or once they are caught up', () => {
    expect(isOverviewSpoiler(episode(5, 5), new Set(), NEXT)).toBe(false);
    expect(isOverviewSpoiler(episode(5, 5), new Set(['s1e1']), undefined)).toBe(false);
  });

  it('hides exactly the unwatched episodes ordered after the next one', () => {
    const position = fc.record({
      season: fc.integer({ min: 1, max: 30 }),
      number: fc.integer({ min: 1, max: 40 }),
    });

    fc.assert(
      fc.property(position, position, fc.boolean(), (target, next, isWatched) => {
        const candidate = episode(target.season, target.number);
        const watched = new Set(['seen', ...(isWatched ? [candidate.id] : [])]);
        const isLater =
          target.season > next.season ||
          (target.season === next.season && target.number > next.number);

        expect(isOverviewSpoiler(candidate, watched, episode(next.season, next.number))).toBe(
          isLater && !isWatched,
        );
      }),
    );
  });
});
