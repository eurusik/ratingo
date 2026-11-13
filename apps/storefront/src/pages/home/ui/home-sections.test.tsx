import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import type { TrendingMedia } from '@/entities/media';
import { openSearch } from '@/features/search';
import { openAuth } from '@/shared/auth';
import { I18nProvider, getDictionary, type Locale } from '@/shared/i18n';
import type { EpisodeRelease } from '../model/home-feed';
import { NewEpisodes } from './new-episodes';
import { NewReleases } from './new-releases';
import { TopTen } from './top-ten';
import { TopTenError } from './top-ten-error';
import { TopThree } from './top-three';
import { TrackShowsCard } from './track-shows-card';

const refresh = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh }) }));
jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/search', () => ({ openSearch: jest.fn() }));
jest.mock('@/shared/auth', () => ({
  ...jest.requireActual('@/shared/auth'),
  openAuth: jest.fn(),
}));
jest.mock('@/shared/api', () => ({
  libraryApi: { getSaveStatuses: jest.fn(), getRatings: jest.fn() },
}));

const uk = getDictionary('uk');

function media(id: string, type: TrendingMedia['type'], extra?: Partial<TrendingMedia>) {
  return { mediaItemId: id, type, slug: id, title: id, providers: [], ...extra };
}

const ANDOR = media('Андор', 'show', { verdict: 'good', watchingNow: 340 });
const DUNE = media('Дюна', 'movie');
const BARBIE = media('Барбі', 'movie');

function renderIn(ui: ReactNode, locale: Locale = 'uk') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
        {ui}
      </I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.mocked(useAuth).mockReturnValue({
    user: null,
    isLoading: false,
    isAuthenticated: false,
  } as unknown as ReturnType<typeof useAuth>);
});

describe('TopTen', () => {
  it('ranks shows first and switches to movies', () => {
    renderIn(<TopTen shows={[ANDOR]} movies={[DUNE, BARBIE]} />);

    const shows = screen.getByRole('list', { name: uk.home.topTen });
    expect(within(shows).getAllByRole('listitem')).toHaveLength(1);
    expect(within(shows).getByRole('link', { name: /Андор/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: uk.home.typeFilter.movie }));

    const movies = screen.getByRole('list', { name: uk.home.topTen });
    expect(movies.tagName).toBe('OL');
    expect(within(movies).getAllByRole('listitem')).toHaveLength(2);
    expect(within(movies).getByRole('link', { name: /Дюна/ })).toHaveAttribute(
      'href',
      '/movies/%D0%94%D1%8E%D0%BD%D0%B0',
    );
  });

  it('shows the only type that loaded, without a filter', () => {
    renderIn(<TopTen shows={[]} movies={[DUNE]} />);

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Дюна/ })).toBeInTheDocument();
  });

  it('renders nothing when nothing is ranked', () => {
    const { container } = renderIn(<TopTen shows={[]} movies={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('NewReleases', () => {
  it('opens on cinemas with a save control and switches to streaming', () => {
    renderIn(<NewReleases lists={{ nowPlaying: [DUNE], newOnDigital: [BARBIE] }} />);

    const cinemas = screen.getByRole('list', { name: uk.home.newReleases });
    expect(within(cinemas).getByRole('button', { name: 'Зберегти «Дюна»' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: uk.home.releaseFilter.newOnDigital }));

    const streaming = screen.getByRole('list', { name: uk.home.newReleases });
    expect(within(streaming).getByRole('link', { name: 'Барбі' })).toBeInTheDocument();
    expect(within(streaming).queryByRole('link', { name: 'Дюна' })).not.toBeInTheDocument();
  });

  it('falls back to the list that still has titles after a refresh', () => {
    const { rerender } = renderIn(
      <NewReleases lists={{ nowPlaying: [DUNE], newOnDigital: [BARBIE] }} />,
    );
    fireEvent.click(screen.getByRole('radio', { name: uk.home.releaseFilter.newOnDigital }));

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider locale="uk" dictionary={uk}>
          <NewReleases lists={{ nowPlaying: [DUNE], newOnDigital: [] }} />
        </I18nProvider>
      </QueryClientProvider>,
    );

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Дюна' })).toBeInTheDocument();
  });
});

describe('TopThree', () => {
  it('ranks titles in order and says how many people are watching', () => {
    renderIn(<TopThree items={[ANDOR, DUNE]} />, 'en');

    const list = screen.getByRole('list', { name: 'Also on top' });
    expect(list.tagName).toBe('OL');
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('1Андор');
    expect(within(list).getByText('340 people are watching now')).toBeInTheDocument();
  });
});

describe('NewEpisodes', () => {
  const release: EpisodeRelease = {
    mediaItemId: 'law',
    slug: 'law',
    showTitle: 'Закон і порядок',
    episodeTitle: 'Do No Harm',
    season: 26,
    episode: 6,
    airedAt: '2026-11-12T23:30:00Z',
  };

  it('shows the episode number and the Kyiv air date', () => {
    renderIn(<NewEpisodes releases={[release]} />);

    const link = screen.getByRole('link', { name: /Закон і порядок/ });
    expect(link).toHaveAttribute('href', '/shows/law');
    expect(link).toHaveTextContent('С26 · Е6');
    expect(link).toHaveTextContent('Сезон 26, серія 6');
    expect(within(link).getByText(/13 лист/)).toHaveAttribute('dateTime', release.airedAt);
  });
});

describe('TrackShowsCard', () => {
  it('invites a guest to sign in or find a show', () => {
    renderIn(<TrackShowsCard />);

    fireEvent.click(screen.getByRole('button', { name: uk.home.track.signIn }));
    expect(openAuth).toHaveBeenCalledWith({ mode: 'login' });

    fireEvent.click(screen.getByRole('button', { name: uk.home.track.find }));
    expect(openSearch).toHaveBeenCalled();
  });

  it('stays hidden for a signed-in user and while the session loads', () => {
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'u1' },
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);
    const { container, rerender } = renderIn(<TrackShowsCard />);
    expect(container).toBeEmptyDOMElement();

    jest.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: true,
    } as unknown as ReturnType<typeof useAuth>);
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider locale="uk" dictionary={uk}>
          <TrackShowsCard />
        </I18nProvider>
      </QueryClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TopTenError', () => {
  it('reloads the server data on retry', () => {
    renderIn(<TopTenError />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(uk.home.topTenFailed);
    fireEvent.click(within(alert).getByRole('button', { name: uk.common.retry }));
    expect(refresh).toHaveBeenCalled();
  });
});
