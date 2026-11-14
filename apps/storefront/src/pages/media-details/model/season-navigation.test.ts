import { act, renderHook } from '@testing-library/react';
import type { Season } from '@/entities/episode';
import { followingSeason, useSeasonNavigation } from './season-navigation';

const NOW = Date.parse('2026-11-14T12:00:00Z');

function season(number: number, airDate: string): Season {
  return {
    number,
    episodes: [{ id: `s${number}e1`, seasonNumber: number, number: 1, airDate }],
  };
}

const SEASONS = [season(1, '2024-01-01'), season(2, '2025-01-01'), season(3, '2999-01-01')];

describe('followingSeason', () => {
  const nothingComplete = () => false;

  it('skips to the next season that has aired episodes', () => {
    expect(followingSeason(SEASONS, SEASONS[0], NOW, nothingComplete)?.number).toBe(2);
  });

  it('has nothing after the last season with aired episodes', () => {
    expect(followingSeason(SEASONS, SEASONS[1], NOW, nothingComplete)).toBeUndefined();
  });

  it('skips seasons that are already finished', () => {
    const secondDone = (candidate: Season) => candidate.number === 2;
    expect(followingSeason(SEASONS, SEASONS[0], NOW, secondDone)).toBeUndefined();
  });
});

describe('useSeasonNavigation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function renderNavigation(initial: number, complete: Set<number>) {
    return renderHook(
      ({ done }) =>
        useSeasonNavigation({
          seasons: SEASONS,
          initial,
          now: NOW,
          isComplete: (candidate) => done.has(candidate.number),
        }),
      { initialProps: { done: complete } },
    );
  }

  it('starts on the initial season without a slide', () => {
    const { result } = renderNavigation(2, new Set());

    expect(result.current.season.number).toBe(2);
    expect(result.current.direction).toBeUndefined();
  });

  it('slides forward or back depending on the picked season', () => {
    const { result } = renderNavigation(2, new Set());

    act(() => result.current.select(3));
    expect(result.current).toMatchObject({ season: { number: 3 }, direction: 'forward' });

    act(() => result.current.select(1));
    expect(result.current).toMatchObject({ season: { number: 1 }, direction: 'back' });
  });

  it('moves on to the next season a moment after the shown season gets finished', () => {
    const { result, rerender } = renderNavigation(1, new Set());

    rerender({ done: new Set([1]) });
    expect(result.current.season.number).toBe(1);

    act(() => jest.runAllTimers());
    expect(result.current).toMatchObject({ season: { number: 2 }, direction: 'forward' });
  });

  it('does not move when the season was already finished on open', () => {
    const { result } = renderNavigation(1, new Set([1]));

    act(() => jest.runAllTimers());
    expect(result.current.season.number).toBe(1);
  });

  it('stays put when the finish is undone or another season is picked first', () => {
    const { result, rerender } = renderNavigation(1, new Set());

    rerender({ done: new Set([1]) });
    rerender({ done: new Set() });
    act(() => jest.runAllTimers());
    expect(result.current.season.number).toBe(1);

    rerender({ done: new Set([1]) });
    act(() => result.current.select(3));
    act(() => jest.runAllTimers());
    expect(result.current.season.number).toBe(3);
  });
});
