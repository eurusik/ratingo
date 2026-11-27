import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { subscriptionsApi, type CalendarMovie, type Subscription } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { calendarMovie } from '../model/calendar-episode.fixture';
import { CalendarProvider } from './calendar-context';
import { CalendarMovieItem } from './calendar-movie';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  subscriptionsApi: { list: jest.fn() },
  libraryApi: { getSaveStatuses: jest.fn().mockResolvedValue({}) },
}));

const NOW = Date.parse('2026-11-12T12:00:00.000Z');
const DUNE = calendarMovie({
  mediaItemId: 'dune',
  title: 'Дюна',
  releaseDate: '2026-11-13T00:00:00.000Z',
});
const AURORA = calendarMovie({
  mediaItemId: 'aurora',
  title: 'Аврора',
  releaseDate: '2026-11-11T00:00:00.000Z',
  isSavedForLater: true,
});

function remindAbout(...mediaItemIds: string[]) {
  const subscriptions = mediaItemIds.map(
    (mediaItemId) => ({ mediaItemId, trigger: 'release', isActive: true }) as Subscription,
  );
  jest
    .mocked(subscriptionsApi.list)
    .mockResolvedValue({ data: subscriptions, meta: { hasMore: false } } as never);
}

function renderRows(movies: readonly CalendarMovie[] = [DUNE, AURORA]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const calendar = {
    mode: 'everyone',
    viewer: 'signedIn',
    now: NOW,
    start: jest.fn(),
  } as unknown as Parameters<typeof CalendarProvider>[0]['value'];
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        <CalendarProvider value={calendar}>
          <ul>
            {movies.map((movie) => (
              <CalendarMovieItem key={movie.mediaItemId} movie={movie} />
            ))}
          </ul>
        </CalendarProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('CalendarMovieItem', () => {
  beforeEach(() => {
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1' },
      isAuthenticated: true,
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('promises a reminder only for a movie that is not out yet', async () => {
    remindAbout('dune', 'aurora');
    renderRows();

    expect(await screen.findByText('в кіно · нагадаємо, коли вийде')).toBeInTheDocument();
    expect(screen.getByText('в кіно · у «Хочу подивитись»')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Зберегти «Дюна»' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Зберегти «Аврора»' })).not.toBeInTheDocument();
  });

  it('keeps the plain release line while no reminder is set', async () => {
    remindAbout();
    renderRows();

    expect(await screen.findByText('в кіно')).toBeInTheDocument();
    expect(screen.queryByText(/нагадаємо/)).not.toBeInTheDocument();
  });

  it('shows the movie backdrop in the same frame as an episode still', () => {
    remindAbout();
    renderRows([
      calendarMovie({
        title: 'Кадр',
        backdrop: image('/backdrop.jpg'),
        poster: image('/poster.jpg'),
      }),
    ]);

    expect(movieImage('Кадр')).toHaveAttribute('src', expect.stringContaining('/backdrop.jpg'));
  });

  it('crops the poster into the frame when there is no backdrop', () => {
    remindAbout();
    renderRows([calendarMovie({ title: 'Постер', poster: image('/poster.jpg') })]);

    expect(movieImage('Постер')).toHaveAttribute('src', expect.stringContaining('/poster.jpg'));
  });

  it('shows the movie icon when there is no image', () => {
    remindAbout();
    renderRows([calendarMovie({ title: 'Порожньо' })]);

    expect(movieImage('Порожньо')).toBeNull();
    expect(screen.getByText('Порожньо').closest('a')?.querySelector('svg')).not.toBeNull();
  });
});

function image(path: string) {
  const url = `https://image.tmdb.org/t/p/w300${path}`;
  return { thumb: url, small: url, medium: url, large: url, original: url };
}

function movieImage(title: string): HTMLElement | null {
  return screen.getByText(title).closest('a')?.querySelector('img') ?? null;
}
