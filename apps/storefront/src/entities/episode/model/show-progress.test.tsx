import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuth } from '@ratingo/web-core/auth';
import { episodeProgressApi, type ShowProgress } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import type { Season } from './season';
import { setEpisodeWatched, useSetEpisodesWatched, useShowProgress } from './show-progress';

jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
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
    episodes: [1, 2, 3].map((number) => ({ id: `e${number}`, seasonNumber: 1, number })),
  },
];

function serverProgress(watchedEpisodeIds: string[]): ShowProgress {
  return {
    showId: 'andor',
    seasons: [
      {
        seasonNumber: 1,
        watchedCount: watchedEpisodeIds.length,
        totalCount: 3,
        watchedEpisodeIds,
      },
    ],
  };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function renderTracker(onSynced = jest.fn(), onFailed = jest.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        {children}
      </I18nProvider>
    </QueryClientProvider>
  );
  const view = renderHook(
    () => ({
      progress: useShowProgress('andor'),
      setWatched: useSetEpisodesWatched({ showId: 'andor', seasons: SEASONS, onSynced, onFailed }),
    }),
    { wrapper },
  );
  return { ...view, onSynced, onFailed };
}

describe('episode progress', () => {
  beforeEach(() => {
    jest.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 'user-1' },
    } as ReturnType<typeof useAuth>);
    api.getShowProgress.mockResolvedValue(serverProgress(['e1']));
  });

  afterEach(() => jest.clearAllMocks());

  it('stays read-only for a guest and never asks for progress', () => {
    jest.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    } as unknown as ReturnType<typeof useAuth>);
    const { result } = renderTracker();

    expect(result.current.progress.canTrack).toBe(false);
    expect(api.getShowProgress).not.toHaveBeenCalled();
  });

  it('shows a toggle at once and syncs with the API after it is saved', async () => {
    const save = deferred();
    api.markWatched.mockReturnValue(save.promise);
    const { result, onSynced } = renderTracker();
    await waitFor(() => expect(result.current.progress.canTrack).toBe(true));

    act(() => result.current.setWatched({ episodeIds: ['e2'], watched: true }));

    await waitFor(() => expect(result.current.progress.watched.has('e2')).toBe(true));
    expect(api.markWatched).toHaveBeenCalledWith('e2');
    expect(api.getShowProgress).toHaveBeenCalledTimes(1);

    api.getShowProgress.mockResolvedValue(serverProgress(['e1', 'e2']));
    await act(async () => save.resolve());

    await waitFor(() => expect(api.getShowProgress).toHaveBeenCalledTimes(2));
    expect(onSynced).toHaveBeenCalledTimes(1);
    expect(result.current.progress.watched).toEqual(new Set(['e1', 'e2']));
  });

  it('sends quick toggles one after another and refetches once they all settle', async () => {
    const first = deferred();
    api.markWatched.mockReturnValue(first.promise);
    api.markUnwatched.mockResolvedValue(undefined);
    const { result, onSynced } = renderTracker();
    await waitFor(() => expect(result.current.progress.canTrack).toBe(true));

    act(() => result.current.setWatched({ episodeIds: ['e2'], watched: true }));
    act(() => result.current.setWatched({ episodeIds: ['e2'], watched: false }));

    await waitFor(() => expect(result.current.progress.watched.has('e2')).toBe(false));
    expect(api.markUnwatched).not.toHaveBeenCalled();

    await act(async () => first.resolve());

    await waitFor(() => expect(api.markUnwatched).toHaveBeenCalledWith('e2'));
    await waitFor(() => expect(api.getShowProgress).toHaveBeenCalledTimes(2));
    expect(onSynced).toHaveBeenCalledTimes(1);
  });

  it('saves several episodes in one batch call', async () => {
    api.markManyWatched.mockResolvedValue(undefined);
    const { result } = renderTracker();
    await waitFor(() => expect(result.current.progress.canTrack).toBe(true));

    act(() => result.current.setWatched({ episodeIds: ['e2', 'e3'], watched: true }));

    await waitFor(() => expect(api.markManyWatched).toHaveBeenCalledWith(['e2', 'e3']));
    expect(api.markWatched).not.toHaveBeenCalled();
  });

  it('reports a failed save and falls back to what the API has', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const save = deferred();
    api.markWatched.mockReturnValue(save.promise);
    const { result, onFailed } = renderTracker();
    await waitFor(() => expect(result.current.progress.canTrack).toBe(true));

    act(() => result.current.setWatched({ episodeIds: ['e3'], watched: true }));
    await waitFor(() => expect(result.current.progress.watched.has('e3')).toBe(true));
    await act(async () => save.reject(new Error('offline')));

    await waitFor(() => expect(result.current.progress.watched.has('e3')).toBe(false));
    expect(onFailed).toHaveBeenCalledTimes(1);
  });

  it('ignores an empty change', async () => {
    const { result } = renderTracker();
    await waitFor(() => expect(result.current.progress.canTrack).toBe(true));

    act(() => result.current.setWatched({ episodeIds: [], watched: true }));

    expect(api.markManyWatched).not.toHaveBeenCalled();
    expect(api.markWatched).not.toHaveBeenCalled();
  });

  it('marks a single episode watched and unwatched for the undo flow', async () => {
    api.markWatched.mockResolvedValue();
    api.markUnwatched.mockResolvedValue();

    await setEpisodeWatched('e2', true);
    await setEpisodeWatched('e2', false);

    expect(api.markWatched).toHaveBeenCalledWith('e2');
    expect(api.markUnwatched).toHaveBeenCalledWith('e2');
    expect(api.markManyWatched).not.toHaveBeenCalled();
  });
});
