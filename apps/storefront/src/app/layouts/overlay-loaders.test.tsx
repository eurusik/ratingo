import { act, render, renderHook, screen } from '@testing-library/react';
import { useAuth } from '@ratingo/web-core/auth';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { AuthDialogLoading } from './auth-dialog-loading';
import { useIsDialogCodePending } from './overlay-loaders';

const mockRequired: string[] = [];
const mockSearchRequiredWhenSignInLoaded: boolean[] = [];

jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/shared/lib', () => ({
  ...jest.requireActual('@/shared/lib'),
  whenIdleOnFastConnection: (run: () => void) => {
    run();
    return () => undefined;
  },
}));
jest.mock('@/features/authenticate', () => {
  mockRequired.push('authenticate');
  return {
    __esModule: true,
    get AuthDialog() {
      mockSearchRequiredWhenSignInLoaded.push(mockRequired.includes('search'));
      return () => null;
    },
  };
});
jest.mock('@/features/search', () => {
  mockRequired.push('search');
  return { __esModule: true, SearchDialog: () => null };
});
jest.mock('@/features/save-to-library', () => {
  mockRequired.push('save-to-library');
  return { __esModule: true, preloadSaveMenuButton: () => Promise.resolve() };
});

async function warmFromCleanSlate(isAuthenticated: boolean): Promise<boolean> {
  mockRequired.length = 0;
  mockSearchRequiredWhenSignInLoaded.length = 0;
  let searchWasRequired = true;
  await jest.isolateModulesAsync(async () => {
    const testing = await import('@testing-library/react/pure');
    const auth = await import('@ratingo/web-core/auth');
    const loaders = await import('./overlay-loaders');
    jest.mocked(auth.useAuth).mockReturnValue({ isAuthenticated } as ReturnType<typeof useAuth>);
    const { result, unmount } = testing.renderHook(() => loaders.useWarmOverlays());
    await testing.waitFor(() => expect(result.current).toBe(true));
    unmount();
    searchWasRequired = mockSearchRequiredWhenSignInLoaded[0];
  });
  return searchWasRequired;
}

describe('useWarmOverlays', () => {
  it('loads the sign-in dialog before the other overlays for a guest', async () => {
    const searchWasRequired = await warmFromCleanSlate(false);

    expect(searchWasRequired).toBe(false);
    expect(mockRequired.toSorted()).toEqual(['authenticate', 'save-to-library', 'search']);
  });

  it('warms every overlay together for a signed-in user', async () => {
    const searchWasRequired = await warmFromCleanSlate(true);

    expect(searchWasRequired).toBe(true);
    expect(mockRequired.toSorted()).toEqual(['authenticate', 'save-to-library', 'search']);
  });
});

function deferred() {
  let settle = { resolve: () => undefined, reject: () => undefined } as {
    resolve: () => void;
    reject: () => void;
  };
  const promise = new Promise<void>((resolve, reject) => {
    settle = { resolve, reject };
  });
  return { promise, ...settle };
}

describe('useIsDialogCodePending', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function renderPending(load: () => Promise<unknown>, onLoadFailed = jest.fn()) {
    return renderHook(
      ({ isRequested, isWarm }) =>
        useIsDialogCodePending({ isRequested, isWarm, load, onLoadFailed }),
      { initialProps: { isRequested: false, isWarm: false } },
    );
  }

  it('says so only once the dialog code has kept the user waiting for a moment', async () => {
    const code = deferred();
    const { result, rerender } = renderPending(() => code.promise);

    rerender({ isRequested: true, isWarm: false });
    expect(result.current).toBe(false);
    act(() => jest.advanceTimersByTime(150));
    expect(result.current).toBe(true);

    await act(async () => code.resolve());
    expect(result.current).toBe(false);
  });

  it('never flashes when the dialog code arrives quickly', async () => {
    const { result, rerender } = renderPending(() => Promise.resolve());

    rerender({ isRequested: true, isWarm: false });
    await act(async () => undefined);
    act(() => jest.advanceTimersByTime(500));

    expect(result.current).toBe(false);
  });

  it('never shows once the overlays are warm', () => {
    const { result, rerender } = renderPending(() => new Promise(() => undefined));

    rerender({ isRequested: true, isWarm: true });
    act(() => jest.advanceTimersByTime(500));

    expect(result.current).toBe(false);
  });

  it('gives up the request when the dialog code fails to load, so a tap can try again', async () => {
    const code = deferred();
    const onLoadFailed = jest.fn();
    const { rerender } = renderPending(() => code.promise, onLoadFailed);

    rerender({ isRequested: true, isWarm: false });
    await act(async () => code.reject());

    expect(onLoadFailed).toHaveBeenCalledTimes(1);
  });
});

describe('AuthDialogLoading', () => {
  it('tells the user the sign-in dialog is on its way', () => {
    render(
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        <AuthDialogLoading />
      </I18nProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Відкриваємо вхід…');
  });
});
