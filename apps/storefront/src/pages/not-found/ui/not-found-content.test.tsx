import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { catalogApi, type SearchItem } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { NotFoundContent } from './not-found-content';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/shared/api', () => ({ catalogApi: { search: jest.fn() } }));

const uk = getDictionary('uk');
const WATCHED_NOW = 'trending titles';

function localTitle(slug: string, title: string): SearchItem {
  return {
    source: 'local',
    type: 'movie',
    slug,
    mediaItemId: slug,
    tmdbId: slug.length,
    title,
    year: 2024,
    rating: 8.4,
    isImported: true,
  };
}

function renderAt(pathname: string) {
  jest.mocked(usePathname).mockReturnValue(pathname);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={uk}>
        <NotFoundContent watchedNow={<p>{WATCHED_NOW}</p>} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('NotFoundContent', () => {
  afterEach(() => jest.mocked(catalogApi.search).mockReset());

  it('offers an empty search and what people watch for an unknown page', () => {
    renderAt('/no-such-page');

    expect(screen.getByRole('heading', { level: 1, name: uk.notFound.page.title })).toBeVisible();
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByText(WATCHED_NOW)).toBeInTheDocument();
    expect(catalogApi.search).not.toHaveBeenCalled();
  });

  it('searches the title from a dead movie link and lists at most three matches', async () => {
    jest.mocked(catalogApi.search).mockResolvedValue({
      query: 'дюна',
      local: [
        localTitle('dyuna-chastyna-druha', 'Дюна: Частина друга'),
        localTitle('dyuna', 'Дюна'),
        localTitle('dyuna-proroctvo', 'Дюна: Пророцтво'),
        localTitle('dyuna-1984', 'Дюна (1984)'),
      ],
      tmdb: [],
    } as unknown as Awaited<ReturnType<typeof catalogApi.search>>);

    renderAt('/movies/dyuna-chastyna-druha-2');

    expect(
      screen.getByRole('heading', { level: 1, name: uk.notFound.media.movie.title }),
    ).toBeVisible();
    expect(screen.getByRole('searchbox')).toHaveValue('дюна частина друга');
    const results = await screen.findByRole('list', { name: uk.search.results });
    expect(within(results).getAllByRole('link')).toHaveLength(3);
    expect(within(results).getByRole('link', { name: /Дюна: Частина друга/ })).toHaveAttribute(
      'href',
      '/movies/dyuna-chastyna-druha',
    );
    expect(screen.queryByText(WATCHED_NOW)).not.toBeInTheDocument();
  });

  it('falls back to what people watch when the search finds nothing', async () => {
    jest.mocked(catalogApi.search).mockResolvedValue({
      query: 'пінгвін',
      local: [],
      tmdb: [],
    } as unknown as Awaited<ReturnType<typeof catalogApi.search>>);

    renderAt('/shows/pinhvin');

    expect(await screen.findByText(WATCHED_NOW)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: uk.notFound.media.show.title }),
    ).toBeVisible();
  });
});
