import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { catalogApi, type TrendingMovie, type TrendingShow } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { TrendingToday } from './trending-today';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/shared/api', () => ({
  catalogApi: { getTrendingShows: jest.fn(), getTrendingMovies: jest.fn() },
  libraryApi: { getSaveStatuses: jest.fn(), getRatings: jest.fn() },
}));

const SHOW = {
  mediaItemId: 'andor-id',
  slug: 'andor',
  title: 'Андор',
  releaseDate: '2022-09-21',
  stats: { ratingoScore: 86, qualityScore: 88 },
  externalRatings: { imdb: { rating: 8.4 } },
} as unknown as TrendingShow;

const MOVIE = {
  mediaItemId: 'dune-id',
  slug: 'dune',
  title: 'Дюна',
  releaseDate: '2021-09-15',
  stats: { ratingoScore: 81, qualityScore: 80 },
  externalRatings: {},
} as unknown as TrendingMovie;

function renderToday() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        <TrendingToday />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('TrendingToday', () => {
  beforeEach(() => {
    jest.mocked(useAuth).mockReturnValue({ isAuthenticated: false } as ReturnType<typeof useAuth>);
  });

  it('shows trending titles with a save control and the top ten in order', async () => {
    jest.mocked(catalogApi.getTrendingShows).mockResolvedValue([SHOW]);
    jest.mocked(catalogApi.getTrendingMovies).mockResolvedValue([MOVIE]);
    renderToday();

    const trending = await screen.findByRole('list', { name: 'Зараз у тренді' });
    expect(within(trending).getAllByRole('listitem')).toHaveLength(2);
    expect(within(trending).getByRole('button', { name: 'Зберегти «Андор»' })).toBeInTheDocument();
    expect(within(trending).getByRole('button', { name: 'Зберегти «Дюна»' })).toBeInTheDocument();

    const top = screen.getByRole('list', { name: 'Топ-10 сьогодні' });
    expect(top.tagName).toBe('OL');
    expect(within(top).getByRole('listitem')).toHaveTextContent(/^1Андор$/);
  });

  it('says so when trending titles cannot load', async () => {
    jest.mocked(catalogApi.getTrendingShows).mockRejectedValue(new Error('offline'));
    jest.mocked(catalogApi.getTrendingMovies).mockResolvedValue([]);
    renderToday();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Не вдалося завантажити тренди. Онови сторінку.');

    jest.mocked(catalogApi.getTrendingShows).mockResolvedValue([SHOW]);
    fireEvent.click(within(alert).getByRole('button', { name: 'Спробувати ще раз' }));

    expect(await screen.findByRole('list', { name: 'Зараз у тренді' })).toBeInTheDocument();
  });

  it('shows placeholders for both sections while loading', () => {
    jest.mocked(catalogApi.getTrendingShows).mockReturnValue(new Promise(() => {}));
    jest.mocked(catalogApi.getTrendingMovies).mockReturnValue(new Promise(() => {}));
    renderToday();

    expect(screen.getByRole('status')).toHaveTextContent('Завантаження…');
    expect(screen.getByRole('heading', { name: 'Зараз у тренді' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Топ-10 сьогодні' })).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
