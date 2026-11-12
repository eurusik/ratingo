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
const FOR_LATER = { isForLater: true, isConsidering: false };

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
  beforeEach(() => {
    jest.mocked(libraryApi.getSaveStatuses).mockResolvedValue({ 'andor-id': NOT_SAVED });
    jest.mocked(libraryApi.save).mockResolvedValue(FOR_LATER);
    jest.mocked(libraryApi.unsave).mockResolvedValue(NOT_SAVED);
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
  });

  it('removes a saved title from every list it is in', async () => {
    signIn(true);
    jest
      .mocked(libraryApi.getSaveStatuses)
      .mockResolvedValue({ 'andor-id': { isForLater: true, isConsidering: true } });
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
    jest.mocked(libraryApi.save).mockRejectedValue(new Error('offline'));
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
});
