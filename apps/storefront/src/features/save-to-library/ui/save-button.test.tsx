import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@heroui/react/toast';
import { useAuth } from '@ratingo/web-core/auth';
import { libraryApi } from '@/shared/api';
import { closeAuth, useAuthRequest } from '@/shared/auth';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { SaveButton } from './save-button';

jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/shared/api', () => ({
  libraryApi: { getSaveStatuses: jest.fn(), save: jest.fn(), unsave: jest.fn() },
}));

const ANDOR = { mediaItemId: 'andor-id', title: 'Андор', type: 'show', slug: 'andor' } as const;
const NOT_SAVED = { isForLater: false, isConsidering: false };
const FOR_LATER_ONLY = { isForLater: true, isConsidering: false };

function signIn(isAuthenticated: boolean) {
  jest.mocked(useAuth).mockReturnValue({ isAuthenticated } as ReturnType<typeof useAuth>);
}

function renderButton() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        <SaveButton media={ANDOR} />
        <ToastProvider />
      </I18nProvider>
    </QueryClientProvider>,
  );
  return screen.getByRole('button', { name: 'Зберегти «Андор»' });
}

describe('SaveButton', () => {
  let server = NOT_SAVED;

  beforeEach(() => {
    server = NOT_SAVED;
    jest
      .mocked(libraryApi.getSaveStatuses)
      .mockImplementation(async () => ({ 'andor-id': server }));
    jest.mocked(libraryApi.save).mockImplementation(async (_id, list) => {
      server = { ...server, [list === 'for_later' ? 'isForLater' : 'isConsidering']: true };
      return server;
    });
    jest.mocked(libraryApi.unsave).mockImplementation(async (_id, list) => {
      server = { ...server, [list === 'for_later' ? 'isForLater' : 'isConsidering']: false };
      return server;
    });
  });

  afterEach(() => {
    act(() => closeAuth());
    jest.clearAllMocks();
  });

  it('saves at once, shows the check and offers to undo', async () => {
    signIn(true);
    const button = renderButton();
    await waitFor(() => expect(libraryApi.getSaveStatuses).toHaveBeenCalled());

    fireEvent.click(button);

    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
    expect(await screen.findByText('«Андор» збережено')).toBeInTheDocument();
    await waitFor(() => expect(libraryApi.save).toHaveBeenCalledWith('andor-id', 'for_later'));

    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }));

    await waitFor(() => expect(libraryApi.unsave).toHaveBeenCalledWith('andor-id', 'for_later'));
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
    expect(server).toEqual(NOT_SAVED);
  });

  it('undo keeps a list the title was already in before a guest saved it', async () => {
    signIn(false);
    server = { isForLater: false, isConsidering: true };
    const { result } = renderHook(() => useAuthRequest());
    const button = renderButton();

    fireEvent.click(button);
    signIn(true);
    act(() => result.current?.onSignedIn?.());
    await waitFor(() => expect(libraryApi.getSaveStatuses).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }));

    await waitFor(() => expect(libraryApi.getSaveStatuses).toHaveBeenCalledTimes(2));
    expect(server).toEqual({ isForLater: false, isConsidering: true });
    expect(libraryApi.save).not.toHaveBeenCalled();
    expect(libraryApi.unsave).not.toHaveBeenCalled();
  });

  it('settles on the last of several quick taps', async () => {
    signIn(true);
    const button = renderButton();
    await waitFor(() => expect(libraryApi.getSaveStatuses).toHaveBeenCalled());

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(server).toEqual(FOR_LATER_ONLY));
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getAllByRole('button', { name: 'Скасувати' })).toHaveLength(1);
  });

  it('removes a saved title from every list it is in', async () => {
    signIn(true);
    server = { isForLater: true, isConsidering: true };
    const button = renderButton();
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(button);

    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
    expect(await screen.findByText('«Андор» прибрано')).toBeInTheDocument();
    await waitFor(() => expect(libraryApi.unsave).toHaveBeenCalledTimes(2));
    expect(jest.mocked(libraryApi.unsave).mock.calls.map(([, list]) => list)).toEqual([
      'for_later',
      'considering',
    ]);
  });

  it('rolls back and explains when the save fails', async () => {
    signIn(true);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(libraryApi.save).mockRejectedValueOnce(new Error('offline'));
    const button = renderButton();
    await waitFor(() => expect(libraryApi.getSaveStatuses).toHaveBeenCalled());

    fireEvent.click(button);

    expect(
      await screen.findByText('Не вдалося оновити збережене. Спробуй ще раз.'),
    ).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('asks a guest to sign in and saves once signed in', async () => {
    signIn(false);
    const { result } = renderHook(() => useAuthRequest());
    const button = renderButton();

    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(result.current).toMatchObject({
      intent: { kind: 'save', title: 'Андор', mediaItemId: 'andor-id' },
    });
    expect(libraryApi.getSaveStatuses).not.toHaveBeenCalled();

    act(() => result.current?.onSignedIn?.());
    await waitFor(() => expect(libraryApi.save).toHaveBeenCalledWith('andor-id', 'for_later'));
  });

  it('opens Зберегти / Відкрити / Поділитися from the keyboard long-press shortcut', async () => {
    signIn(true);
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const button = renderButton();

    fireEvent.keyDown(button, { key: 'ArrowDown', altKey: true });

    const menu = await screen.findByRole('menu');
    expect(
      Array.from(menu.querySelectorAll('[role="menuitem"]'), (item) => item.textContent),
    ).toEqual(['Зберегти', 'Відкрити', 'Поділитися']);
    expect(screen.getByRole('menuitem', { name: 'Відкрити' })).toHaveAttribute(
      'href',
      '/shows/andor',
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Поділитися' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('http://localhost/shows/andor'));
    expect(await screen.findByText('Посилання скопійовано')).toBeInTheDocument();
  });

  it('opens the menu on a long press', async () => {
    class TouchPointerEvent extends MouseEvent {
      pointerId = 1;
      pointerType = 'touch';
      width = 1;
      height = 1;
    }
    Object.assign(window, { PointerEvent: TouchPointerEvent });
    jest.useFakeTimers();
    signIn(true);
    const button = renderButton();

    fireEvent(button, new TouchPointerEvent('pointerdown', { bubbles: true, button: 0 }));
    act(() => jest.advanceTimersByTime(600));
    fireEvent(button, new TouchPointerEvent('pointerup', { bubbles: true, button: 0 }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(libraryApi.save).not.toHaveBeenCalled();
    jest.useRealTimers();
    Reflect.deleteProperty(window, 'PointerEvent');
  });

  it('never removes a title the server already has when its status has not loaded yet', async () => {
    signIn(true);
    server = FOR_LATER_ONLY;
    let calls = 0;
    jest.mocked(libraryApi.getSaveStatuses).mockImplementation(() => {
      calls += 1;
      return calls === 1 ? new Promise(() => {}) : Promise.resolve({ 'andor-id': server });
    });
    const button = renderButton();

    fireEvent.click(button);

    await waitFor(() => expect(calls).toBe(2));
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
    expect(libraryApi.unsave).not.toHaveBeenCalled();
    expect(server).toEqual(FOR_LATER_ONLY);
  });

  it('undo pressed while the save is still in flight ends unsaved', async () => {
    signIn(true);
    let finishSave: () => void = () => {};
    jest.mocked(libraryApi.save).mockImplementation(
      (_id, list) =>
        new Promise((resolve) => {
          finishSave = () => {
            server = { ...server, [list === 'for_later' ? 'isForLater' : 'isConsidering']: true };
            resolve(server);
          };
        }),
    );
    const button = renderButton();
    await waitFor(() => expect(libraryApi.getSaveStatuses).toHaveBeenCalled());

    fireEvent.click(button);
    fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }));
    await waitFor(() => expect(libraryApi.save).toHaveBeenCalled());
    act(() => finishSave());

    await waitFor(() => expect(server).toEqual(NOT_SAVED));
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
  });

  it('takes the undo offer away when the change fails', async () => {
    signIn(true);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(libraryApi.save).mockRejectedValueOnce(new Error('offline'));
    const button = renderButton();
    await waitFor(() => expect(libraryApi.getSaveStatuses).toHaveBeenCalled());

    fireEvent.click(button);

    expect(
      await screen.findByText('Не вдалося оновити збережене. Спробуй ще раз.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Скасувати' })).not.toBeInTheDocument(),
    );
  });
});
