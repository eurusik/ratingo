import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@heroui/react/toast';
import { useAuth } from '@ratingo/web-core/auth';
import { libraryApi, type UserMediaState } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { DetailsTopBar } from './details-top-bar';

jest.mock('next/navigation', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('@ratingo/web-core/auth', () => ({
  useAuth: jest.fn(),
  tokenStorage: { getRefreshToken: () => 'refresh-token' },
}));
jest.mock('@/shared/api', () => ({
  episodeProgressApi: { getShowProgress: jest.fn() },
  libraryApi: { getMediaState: jest.fn(), removeFromLibrary: jest.fn() },
}));

const DUNE = { mediaItemId: 'dune-id', type: 'movie', slug: 'dune-2', title: 'Дюна' } as const;

function renderTopBar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        <DetailsTopBar media={DUNE} backHref="/" />
        <ToastProvider />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

function signIn(isAuthenticated: boolean) {
  jest
    .mocked(useAuth)
    .mockReturnValue({ isAuthenticated, isLoading: false } as ReturnType<typeof useAuth>);
}

describe('DetailsTopBar', () => {
  afterEach(() => jest.clearAllMocks());

  it('lets a viewer take a title out of the library from the more menu', async () => {
    signIn(true);
    jest
      .mocked(libraryApi.getMediaState)
      .mockResolvedValue({ mediaItemId: 'dune-id', rating: 80 } as UserMediaState);
    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: 'Ще дії: Дюна' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Прибрати з бібліотеки' }));

    expect(await screen.findByText('Прибрано з бібліотеки: Дюна')).toBeInTheDocument();
  });

  it('offers a guest only sharing', async () => {
    signIn(false);
    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: 'Ще дії: Дюна' }));

    expect(await screen.findByRole('menuitem', { name: 'Поділитися' })).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Прибрати з бібліотеки' }),
    ).not.toBeInTheDocument();
    expect(libraryApi.getMediaState).not.toHaveBeenCalled();
  });
});
