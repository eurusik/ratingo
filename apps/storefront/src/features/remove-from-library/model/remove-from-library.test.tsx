import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { libraryApi, type UserMediaState } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { showUndoToast, track } from '@/shared/lib';
import { useRemoveFromLibrary } from './remove-from-library';

jest.mock('@/shared/api', () => ({
  libraryApi: { removeFromLibrary: jest.fn(), getMediaState: jest.fn() },
}));
jest.mock('@/shared/lib', () => ({
  ...jest.requireActual('@/shared/lib'),
  showUndoToast: jest.fn(),
  track: jest.fn(),
}));
jest.mock('@heroui/react', () => ({
  ...jest.requireActual('@heroui/react'),
  toast: Object.assign(jest.fn(), { danger: jest.fn(), close: jest.fn() }),
}));

const DUNE = { mediaItemId: 'dune-id', title: 'Дюна' };
const RATED = { mediaItemId: 'dune-id', rating: 80, state: 'completed' } as UserMediaState;
const MEDIA_STATE_KEY = ['library', 'media-state', 'dune-id'];

type UndoToastOptions = Parameters<typeof showUndoToast>[0];

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(MEDIA_STATE_KEY, RATED);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        {children}
      </I18nProvider>
    </QueryClientProvider>
  );
  const { result } = renderHook(() => useRemoveFromLibrary(), { wrapper });
  return { queryClient, remove: result.current };
}

function lastUndoToast(): UndoToastOptions {
  const calls = jest.mocked(showUndoToast).mock.calls;
  return calls[calls.length - 1]![0];
}

describe('useRemoveFromLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(libraryApi.removeFromLibrary).mockResolvedValue(undefined);
    jest.mocked(libraryApi.getMediaState).mockResolvedValue(null);
  });

  afterEach(() => jest.restoreAllMocks());

  it('hides the title at once and offers to undo before removing anything', () => {
    const { queryClient, remove } = setup();

    act(() => remove(DUNE));

    expect(queryClient.getQueryData(MEDIA_STATE_KEY)).toBeNull();
    expect(lastUndoToast().message).toBe('Прибрано з бібліотеки: Дюна');
    expect(libraryApi.removeFromLibrary).not.toHaveBeenCalled();
  });

  it('removes the title and tracks it once the undo window passes', async () => {
    const { remove } = setup();
    const onSettled = jest.fn();

    act(() => remove(DUNE, { onSettled }));
    act(() => lastUndoToast().onKept?.());

    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    expect(libraryApi.removeFromLibrary).toHaveBeenCalledWith('dune-id');
    expect(track).toHaveBeenCalledWith('library_action', { action: 'remove_from_library' });
  });

  it('puts the title back without calling the API when undone', () => {
    const { queryClient, remove } = setup();
    const onUndo = jest.fn();

    act(() => remove(DUNE, { onUndo }));
    act(() => lastUndoToast().onUndo());

    expect(queryClient.getQueryData(MEDIA_STATE_KEY)).toEqual(RATED);
    expect(onUndo).toHaveBeenCalled();
    expect(libraryApi.removeFromLibrary).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('restores the title and reports the failure when removing fails', async () => {
    jest.mocked(libraryApi.removeFromLibrary).mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { remove } = setup();
    const onUndo = jest.fn();
    const onSettled = jest.fn();

    act(() => remove(DUNE, { onUndo, onSettled }));
    act(() => lastUndoToast().onKept?.());

    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    expect(onUndo).toHaveBeenCalled();
    expect(toast.danger).toHaveBeenCalledWith('Не вдалося прибрати з бібліотеки. Спробуй ще раз.');
    expect(track).not.toHaveBeenCalled();
  });

  it('keeps the title when it is rated again before the undo window passes', async () => {
    const { queryClient, remove } = setup();
    const onUndo = jest.fn();
    const onSettled = jest.fn();

    act(() => remove(DUNE, { onUndo, onSettled }));
    act(() => {
      queryClient.setQueryData(MEDIA_STATE_KEY, { ...RATED, rating: 60 });
    });
    act(() => lastUndoToast().onKept?.());

    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    expect(onUndo).toHaveBeenCalled();
    expect(libraryApi.removeFromLibrary).not.toHaveBeenCalled();
  });

  it('sends the removal when the page is closed during the undo window', async () => {
    const { remove } = setup();

    act(() => remove(DUNE));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    await waitFor(() => expect(libraryApi.removeFromLibrary).toHaveBeenCalledWith('dune-id'));
    const sent = jest.mocked(libraryApi.removeFromLibrary).mock.calls.length;
    act(() => lastUndoToast().onKept?.());
    expect(libraryApi.removeFromLibrary).toHaveBeenCalledTimes(sent);
  });
});
