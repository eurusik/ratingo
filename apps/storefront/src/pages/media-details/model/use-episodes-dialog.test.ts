import { act, renderHook } from '@testing-library/react';
import type { Season } from '@/entities/episode';
import { useEpisodesDialog } from './use-episodes-dialog';

const SEASONS: Season[] = [
  { number: 1, episodes: [] },
  { number: 2, episodes: [] },
];

describe('useEpisodesDialog', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('opens on the linked season once the viewer can track', () => {
    window.history.replaceState(null, '', '/shows/arcane?season=2');
    const { result, rerender } = renderHook(
      ({ canTrack, isResolving }) => useEpisodesDialog({ seasons: SEASONS, canTrack, isResolving }),
      { initialProps: { canTrack: false, isResolving: true } },
    );

    expect(result.current.dialog.isOpen).toBe(false);
    rerender({ canTrack: true, isResolving: false });
    expect(result.current.dialog).toMatchObject({ isOpen: true, initialSeason: 2 });
  });

  it('forgets the link after the sheet is closed', () => {
    window.history.replaceState(null, '', '/shows/arcane?season=2');
    const { result } = renderHook(() =>
      useEpisodesDialog({ seasons: SEASONS, canTrack: true, isResolving: false }),
    );

    act(() => result.current.setOpen(false));

    expect(result.current.dialog.isOpen).toBe(false);
    expect(window.location.search).toBe('');
  });

  it('ignores seasons the show does not have', () => {
    window.history.replaceState(null, '', '/shows/arcane?season=7');
    const { result } = renderHook(() =>
      useEpisodesDialog({ seasons: SEASONS, canTrack: true, isResolving: false }),
    );

    expect(result.current.dialog.isOpen).toBe(false);
    expect(window.location.search).toBe('');
  });

  it('drops the link when the viewer cannot track, so it never opens later', () => {
    window.history.replaceState(null, '', '/shows/arcane?season=2');
    const { result, rerender } = renderHook(
      ({ canTrack }) => useEpisodesDialog({ seasons: SEASONS, canTrack, isResolving: false }),
      { initialProps: { canTrack: false } },
    );

    expect(window.location.search).toBe('');
    rerender({ canTrack: true });
    expect(result.current.dialog.isOpen).toBe(false);
  });

  it('opens straight in pick mode from a pick link', () => {
    window.history.replaceState(null, '', '/shows/arcane?season=pick');
    const { result } = renderHook(() =>
      useEpisodesDialog({ seasons: SEASONS, canTrack: true, isResolving: false }),
    );

    expect(result.current.dialog).toMatchObject({ isOpen: true, isPicking: true });
  });
});
