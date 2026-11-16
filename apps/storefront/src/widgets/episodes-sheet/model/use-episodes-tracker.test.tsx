import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import type { Season } from '@/entities/episode';
import { episodeProgressApi } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { useEpisodesTracker } from './use-episodes-tracker';

jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@heroui/react', () => ({
  ...jest.requireActual('@heroui/react'),
  toast: { danger: jest.fn() },
}));
jest.mock('@/shared/api', () => ({
  episodeProgressApi: {
    getShowProgress: jest.fn(),
    markWatched: jest.fn(),
    markUnwatched: jest.fn(),
    markManyWatched: jest.fn(),
    markManyUnwatched: jest.fn(),
  },
}));

const api = jest.mocked(episodeProgressApi);

const SEASONS: Season[] = [
  {
    number: 1,
    episodes: [1, 2, 3].map((number) => ({
      id: `s1e${number}`,
      seasonNumber: 1,
      number,
      airDate: '2024-01-01',
    })),
  },
  {
    number: 2,
    episodes: [
      { id: 's2e1', seasonNumber: 2, number: 1, airDate: '2024-06-01' },
      { id: 's2e2', seasonNumber: 2, number: 2, airDate: '2024-06-08' },
      { id: 's2e3', seasonNumber: 2, number: 3, airDate: '2999-01-01' },
    ],
  },
];

function fakeServer(initiallyWatched: string[]) {
  const serverWatched = new Set(initiallyWatched);
  api.getShowProgress.mockImplementation(async () => ({
    showId: 'andor',
    seasons: SEASONS.map((season) => {
      const ids = season.episodes.flatMap((episode) =>
        episode.id && serverWatched.has(episode.id) ? [episode.id] : [],
      );
      return {
        seasonNumber: season.number,
        watchedCount: ids.length,
        totalCount: season.episodes.length,
        watchedEpisodeIds: ids,
      };
    }),
  }));
  api.markWatched.mockImplementation(async (id) => void serverWatched.add(id));
  api.markUnwatched.mockImplementation(async (id) => void serverWatched.delete(id));
  api.markManyWatched.mockImplementation(async (ids) => {
    for (const id of ids) serverWatched.add(id);
  });
  api.markManyUnwatched.mockImplementation(async (ids) => {
    for (const id of ids) serverWatched.delete(id);
  });
  return serverWatched;
}

async function renderTracker() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        {children}
      </I18nProvider>
    </QueryClientProvider>
  );
  const view = renderHook(
    () => useEpisodesTracker({ showId: 'andor', mediaItemId: 'andor-item', seasons: SEASONS }),
    { wrapper },
  );
  await waitFor(() => expect(view.result.current.canTrack).toBe(true));
  return view;
}

describe('useEpisodesTracker', () => {
  beforeEach(() => {
    jest.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 'user-1' },
    } as ReturnType<typeof useAuth>);
  });

  afterEach(() => jest.clearAllMocks());

  it('summarizes the progress over aired episodes only', async () => {
    fakeServer(['s1e1']);
    const { result } = await renderTracker();

    expect(result.current.summary).toMatchObject({ watched: 1, aired: 5 });
    expect(result.current.summary.next?.id).toBe('s1e2');
  });

  it('marks one episode and can undo it', async () => {
    const server = fakeServer(['s1e1']);
    const { result } = await renderTracker();

    act(() => result.current.toggle(SEASONS[0].episodes[1], true));

    await waitFor(() => expect(result.current.notice?.message).toBe('Переглянуто С1 · Е2'));
    expect(result.current.notice?.narrow).toBeUndefined();

    act(() => result.current.undoNotice());

    await waitFor(() => expect(server.has('s1e2')).toBe(false));
    expect(result.current.notice).toBeUndefined();
  });

  it('keeps the notice while the viewer holds it and hides it after release', async () => {
    fakeServer(['s1e1']);
    const { result } = await renderTracker();
    jest.useFakeTimers();

    act(() => result.current.toggle(SEASONS[0].episodes[1], true));
    act(() => result.current.holdNotice(true));
    act(() => jest.advanceTimersByTime(10_000));
    expect(result.current.notice).toBeDefined();

    act(() => result.current.holdNotice(false));
    act(() => jest.advanceTimersByTime(10_000));
    expect(result.current.notice).toBeUndefined();
    jest.useRealTimers();
  });

  it('fills the gap before a marked episode in its season and can keep only that one', async () => {
    const server = fakeServer([]);
    const { result } = await renderTracker();

    act(() => result.current.toggle(SEASONS[1].episodes[1], true));

    await waitFor(() => expect(result.current.notice?.message).toBe('Позначено Е1–Е2'));
    expect([...server].sort()).toEqual(['s2e1', 's2e2']);
    expect(result.current.notice?.narrow?.label).toBe('Лише Е2');

    act(() => result.current.narrowNotice());

    await waitFor(() => expect([...server]).toEqual(['s2e2']));
    await waitFor(() => expect(result.current.summary.watched).toBe(1));
  });

  it('unmarks an episode', async () => {
    const server = fakeServer(['s1e1', 's1e2']);
    const { result } = await renderTracker();

    act(() => result.current.toggle(SEASONS[0].episodes[1], false));

    await waitFor(() => expect(result.current.notice?.message).toBe('Знято: С1 · Е2'));
    expect(server.has('s1e2')).toBe(false);
  });

  it('marks and resets a whole season', async () => {
    const server = fakeServer(['s2e1']);
    const { result } = await renderTracker();

    act(() => result.current.markSeason(SEASONS[1]));
    await waitFor(() => expect(result.current.notice?.message).toBe('Сезон 2 переглянуто'));
    expect(server.has('s2e2')).toBe(true);
    expect(server.has('s2e3')).toBe(false);

    act(() => result.current.resetSeason(SEASONS[1]));
    await waitFor(() => expect(result.current.notice?.message).toBe('Сезон 2 скинуто'));
    expect([...server]).toEqual([]);
  });

  it('resets the whole show and can undo it', async () => {
    const server = fakeServer(['s1e1', 's1e2', 's2e1']);
    const { result } = await renderTracker();

    act(() => result.current.resetAll());

    await waitFor(() => expect(server.size).toBe(0));
    expect(result.current.notice?.message).toBe('Увесь прогрес скинуто');

    act(() => result.current.undoNotice());

    await waitFor(() => expect([...server].sort()).toEqual(['s1e1', 's1e2', 's2e1']));
  });

  it('catches up on everything aired', async () => {
    const server = fakeServer(['s1e1']);
    const { result } = await renderTracker();

    act(() => result.current.catchUp());

    await waitFor(() =>
      expect(result.current.notice?.message).toBe('Позначено все, що вийшло: 4 серії'),
    );
    expect(server.size).toBe(5);
    expect(result.current.summary.next).toBeUndefined();
  });

  it('marks everything up to the episode the viewer stopped at, across seasons', async () => {
    const server = fakeServer([]);
    const { result } = await renderTracker();

    act(() => result.current.markThrough(SEASONS[1].episodes[0]));

    await waitFor(() => expect(result.current.notice?.message).toBe('Позначено все до С2 · Е1'));
    expect([...server].sort()).toEqual(['s1e1', 's1e2', 's1e3', 's2e1']);
    expect(result.current.summary.next?.id).toBe('s2e2');
  });

  it('drops the notice and tells the viewer when saving fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fakeServer([]);
    api.markWatched.mockRejectedValue(new Error('offline'));
    const { result } = await renderTracker();

    act(() => result.current.toggle(SEASONS[0].episodes[0], true));
    expect(result.current.notice?.message).toBe('Переглянуто С1 · Е1');

    await waitFor(() => expect(result.current.notice).toBeUndefined());
    expect(toast.danger).toHaveBeenCalledWith(getDictionary('uk').episodes.notice.failed);
  });
});
