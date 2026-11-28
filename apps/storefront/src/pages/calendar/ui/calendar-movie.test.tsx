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
        backdrop: backdropImage('/backdrop.jpg'),
        poster: posterImage('/poster.jpg'),
      }),
    ]);

    const still = movieImage('Кадр');
    expect(still).toHaveAttribute('src', expect.stringContaining('/w300/backdrop.jpg'));
    expect(still).not.toHaveClass('object-[center_20%]');
  });

  it('crops the poster into the frame when there is no backdrop', () => {
    remindAbout();
    renderRows([calendarMovie({ title: 'Постер', poster: posterImage('/poster.jpg') })]);

    const still = movieImage('Постер');
    expect(still).toHaveAttribute('src', expect.stringContaining('/w342/poster.jpg'));
    expect(still).toHaveClass('object-[center_20%]');
  });

  it('shows the movie icon when there is no image', () => {
    remindAbout();
    renderRows([calendarMovie({ title: 'Порожньо' })]);

    expect(movieImage('Порожньо')).toBeNull();
    expect(screen.getByText('Порожньо').closest('a')?.querySelector('svg')).not.toBeNull();
  });
});

function tmdbImage(
  path: string,
  [thumb, small, medium, large]: readonly [string, string, string, string],
) {
  const url = (size: string) => `https://image.tmdb.org/t/p/${size}${path}`;
  return {
    thumb: url(thumb),
    small: url(small),
    medium: url(medium),
    large: url(large),
    original: url('original'),
  };
}

const posterImage = (path: string) => tmdbImage(path, ['w154', 'w342', 'w500', 'w780']);
const backdropImage = (path: string) => tmdbImage(path, ['w300', 'w300', 'w780', 'w1280']);

function movieImage(title: string): HTMLElement | null {
  return screen.getByText(title).closest('a')?.querySelector('img') ?? null;
}
