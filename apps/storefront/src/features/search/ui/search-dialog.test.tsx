import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Button } from '@heroui/react';
import { catalogApi, type SearchItem, type TrendingShow } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { openSearch, setSearchOpen } from '../model/search-dialog-state';
import { clearRecentTitles, rememberTitle } from '../model/recent-titles';
import { SearchDialog } from './search-dialog';

const push = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

jest.mock('@/shared/api', () => ({
  catalogApi: {
    search: jest.fn(),
    importMedia: jest.fn(),
    getImportStatus: jest.fn(),
    getTrendingMovies: jest.fn(),
    getTrendingShows: jest.fn(),
  },
}));

const uk = getDictionary('uk');

const LOCAL_DUNE: SearchItem = {
  source: 'local',
  type: 'movie',
  slug: 'dune-2021',
  mediaItemId: 'media-1',
  tmdbId: 438631,
  title: 'Дюна',
  year: 2021,
  rating: 8,
  isImported: true,
};

const PROPHECY: SearchItem = {
  source: 'local',
  type: 'show',
  slug: 'dune-prophecy',
  tmdbId: 90228,
  title: 'Дюна: Пророцтво',
  year: 2024,
  rating: 6.9,
  isImported: true,
};

const TMDB_DUNE: SearchItem = {
  source: 'tmdb',
  type: 'movie',
  tmdbId: 841,
  title: 'Дюна',
  year: 1984,
  rating: 6.3,
  isImported: false,
};

const TRENDING_SHOW = {
  mediaItemId: 'andor-id',
  slug: 'andor',
  title: 'Андор',
  releaseDate: '2022-09-21',
  poster: null,
  stats: { ratingoScore: 86 },
} as unknown as TrendingShow;

function renderSearch(renderActions?: Parameters<typeof SearchDialog>[0]['renderActions']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={uk}>
        <SearchDialog renderActions={renderActions} />
      </I18nProvider>
    </QueryClientProvider>,
  );
  act(() => openSearch());
}

async function typeQuery(query: string) {
  const field = await screen.findByRole('searchbox', { name: uk.search.title });
  fireEvent.change(field, { target: { value: query } });
}

describe('SearchDialog', () => {
  beforeEach(() => {
    act(() => clearRecentTitles());
    jest.mocked(catalogApi.getTrendingMovies).mockResolvedValue([]);
    jest.mocked(catalogApi.getTrendingShows).mockResolvedValue([]);
    jest
      .mocked(catalogApi.search)
      .mockResolvedValue({ query: 'дюна', local: [LOCAL_DUNE, PROPHECY], tmdb: [TMDB_DUNE] });
  });

  afterEach(() => {
    act(() => setSearchOpen(false));
    jest.clearAllMocks();
  });

  it('shows recently opened titles from this device and lets you remove one', async () => {
    rememberTitle({
      key: 'x',
      isInCatalog: true,
      type: 'show',
      slug: 'andor',
      title: 'Андор',
      year: 2025,
    });
    renderSearch();

    const list = await screen.findByRole('grid', { name: uk.search.title });
    expect(within(list).getByRole('row', { name: /Андор/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Прибрати «Андор» з нещодавніх' }));
    await waitFor(() =>
      expect(within(list).queryByRole('row', { name: /Андор/ })).not.toBeInTheDocument(),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('finds titles with a rating verdict, an actions slot and a type filter', async () => {
    renderSearch((title) => <Button>{`Зберегти ${title.title}`}</Button>);
    await typeQuery('дюна');

    const results = await screen.findByRole('grid', { name: uk.search.results });
    const dune = await within(results).findByRole('row', { name: /^Дюна, Фільм · 2021/ });
    expect(dune).toHaveAccessibleName('Дюна, Фільм · 2021, Оцінка 8,0: Варто');
    fireEvent.click(within(dune).getByRole('button', { name: 'Зберегти Дюна' }));
    expect(push).not.toHaveBeenCalled();
    expect(within(results).getByText(uk.search.otherResults)).toBeInTheDocument();
    expect(within(results).queryByRole('button', { name: /Додати/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: uk.search.filters.show }));
    await waitFor(() =>
      expect(within(results).queryByRole('row', { name: /2021/ })).not.toBeInTheDocument(),
    );
    expect(within(results).getByRole('row', { name: /Пророцтво/ })).toBeInTheDocument();
  });

  it('opens a catalog title and remembers it', async () => {
    renderSearch();
    await typeQuery('дюна');

    fireEvent.click(await screen.findByRole('row', { name: /^Дюна, Фільм · 2021/ }));

    expect(push).toHaveBeenCalledWith('/movies/dune-2021');
    expect(window.localStorage.getItem('ratingo:recent-titles:v1')).toContain('dune-2021');
  });

  it('skips the section header when moving down from an empty field', async () => {
    jest.mocked(catalogApi.getTrendingShows).mockResolvedValue([TRENDING_SHOW]);
    renderSearch();
    const firstRow = await screen.findByRole('row', { name: /Андор/ });

    fireEvent.keyDown(screen.getByRole('searchbox', { name: uk.search.title }), {
      key: 'ArrowDown',
    });

    expect(firstRow).toHaveFocus();
  });

  it('opens the first result with Enter from the field', async () => {
    renderSearch();
    await typeQuery('дюна');
    await screen.findByRole('row', { name: /^Дюна, Фільм · 2021/ });

    fireEvent.keyDown(screen.getByRole('searchbox', { name: uk.search.title }), { key: 'Enter' });

    expect(push).toHaveBeenCalledWith('/movies/dune-2021');
  });

  it('moves between the field and the results with the arrow keys', async () => {
    renderSearch();
    await typeQuery('дюна');
    const firstRow = await screen.findByRole('row', { name: /^Дюна, Фільм · 2021/ });
    const field = screen.getByRole('searchbox', { name: uk.search.title });

    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(firstRow).toHaveFocus();

    fireEvent.keyDown(firstRow, { key: 'ArrowUp' });
    expect(field).toHaveFocus();

    fireEvent.keyDown(field, { key: 'ArrowDown' });
    fireEvent.keyDown(firstRow, { key: 'Enter' });
    fireEvent.keyUp(firstRow, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/movies/dune-2021');
  });

  it('imports a TMDB title on tap and opens it when the page is ready', async () => {
    jest
      .mocked(catalogApi.importMedia)
      .mockResolvedValue({ status: 'exists', type: 'movie', tmdbId: 841, slug: 'dune-1984' });
    renderSearch();
    await typeQuery('дюна');

    fireEvent.click(await screen.findByRole('row', { name: 'Дюна, Фільм · 1984' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/movies/dune-1984'));
    expect(catalogApi.importMedia).toHaveBeenCalledWith('movie', 841);
  });

  it('shows the preparing screen while an import runs', async () => {
    jest.mocked(catalogApi.importMedia).mockReturnValue(new Promise(() => {}));
    renderSearch();
    await typeQuery('дюна');

    fireEvent.click(await screen.findByRole('row', { name: 'Дюна, Фільм · 1984' }));

    expect(await screen.findByRole('status')).toHaveTextContent(uk.search.preparing);
  });
});
