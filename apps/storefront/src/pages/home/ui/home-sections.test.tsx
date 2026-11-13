import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import type { TrendingMedia } from '@/entities/media';
import { openSearch } from '@/features/search';
import { openAuth } from '@/shared/auth';
import { I18nProvider, getDictionary, type Locale } from '@/shared/i18n';
import type { EpisodeRelease, TrendingHighlights } from '../model/home-feed';
import { NewEpisodes } from './new-episodes';
import { SectionError } from './section-error';
import { TopThree } from './top-three';
import { TrackShowsCard } from './track-shows-card';
import { TrendingNow } from './trending-now';

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

describe('TrendingNow', () => {
  const highlights: TrendingHighlights = { all: [ANDOR, DUNE], show: [ANDOR], movie: [DUNE] };

  it('shows mixed titles with a save control and filters them by type', () => {
    renderIn(<TrendingNow highlights={highlights} />);

    const rail = screen.getByRole('list', { name: uk.home.trending });
    expect(within(rail).getAllByRole('listitem')).toHaveLength(2);
    expect(within(rail).getByRole('button', { name: 'Зберегти «Андор»' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: uk.home.typeFilter.movie }));

    const movies = screen.getByRole('list', { name: uk.home.trending });
    expect(within(movies).getAllByRole('listitem')).toHaveLength(1);
    expect(within(movies).getByRole('link', { name: 'Дюна' })).toHaveAttribute(
      'href',
      '/movies/%D0%94%D1%8E%D0%BD%D0%B0',
    );
  });

  it('hides the type filter when one type is missing', () => {
    renderIn(<TrendingNow highlights={{ all: [ANDOR], show: [ANDOR], movie: [] }} />);

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('renders nothing when nothing is trending', () => {
    const { container } = renderIn(<TrendingNow highlights={{ all: [], show: [], movie: [] }} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('TopThree', () => {
  it('ranks titles in order and says how many people are watching', () => {
    renderIn(<TopThree list="watchingNow" items={[ANDOR, DUNE]} />, 'en');

    const list = screen.getByRole('list', { name: 'Watching right now' });
    expect(list.tagName).toBe('OL');
    expect(within(list).getByRole('link', { name: 'No. 1. Андор' })).toBeInTheDocument();
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

describe('SectionError', () => {
  it('reloads the server data on retry', () => {
    renderIn(<SectionError message={uk.home.trendingFailed} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(uk.home.trendingFailed);
    fireEvent.click(within(alert).getByRole('button', { name: uk.common.retry }));
    expect(refresh).toHaveBeenCalled();
  });
});
