import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import type { TrendingMedia } from '../model/media';
import { ProviderLogos } from './provider-logos';
import { TopRankTile } from './top-rank-tile';
import { TrendingCard } from './trending-card';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
      {children}
    </I18nProvider>
  );
}

const ANDOR: TrendingMedia = {
  mediaItemId: 'andor-id',
  type: 'show',
  slug: 'andor',
  title: 'Андор',
  year: 2022,
  backdropUrl: 'https://image.tmdb.org/t/p/w300/andor.jpg',
  posterUrl: 'https://image.tmdb.org/t/p/w342/andor.jpg',
  imdbRating: 8.3,
  criticsPercent: 76,
  watchingNow: 192,
  verdict: 'good',
  event: 'NEW_EPISODE',
  providers: [
    { id: 'disney', name: 'Disney+' },
    { id: 'megogo', name: 'Megogo' },
  ],
};

describe('TrendingCard', () => {
  it('links the title and shows IMDb, the event, the verdict, details and where to watch', () => {
    render(<TrendingCard media={ANDOR} actions={<button type="button">Дія</button>} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByRole('link', { name: 'Андор' })).toHaveAttribute('href', '/shows/andor');
    expect(screen.getByText('IMDb')).toHaveAttribute('aria-hidden');
    expect(screen.getByText('8,3')).toHaveAttribute('aria-hidden');
    expect(screen.getByText('Оцінка IMDb 8,3')).toBeInTheDocument();
    expect(screen.getByText('76%')).toHaveAttribute('aria-hidden');
    expect(screen.getByText('Rotten Tomatoes: 76% критиків')).toBeInTheDocument();
    expect(screen.getByText('Зараз дивляться 192 людини')).toBeInTheDocument();
    expect(screen.getByText('Нова серія')).toBeInTheDocument();
    expect(screen.getByText('Варто')).toBeInTheDocument();
    expect(screen.getByText('Вердикт Ratingo:')).toBeInTheDocument();
    expect(screen.getByText('Серіал · 2022')).toBeInTheDocument();
    const providers = screen.getByRole('list', { name: 'Де дивитись' });
    expect(within(providers).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Дія' })).toBeInTheDocument();
  });

  it('shows only IMDb when there is no critics score', () => {
    render(<TrendingCard media={{ ...ANDOR, criticsPercent: undefined }} />, { wrapper: Wrapper });

    expect(screen.getByText('Оцінка IMDb 8,3')).toBeInTheDocument();
    expect(screen.queryByText(/Rotten Tomatoes/)).not.toBeInTheDocument();
  });

  it('leaves out what the title does not have', () => {
    render(
      <TrendingCard
        media={{
          ...ANDOR,
          imdbRating: undefined,
          criticsPercent: undefined,
          watchingNow: undefined,
          verdict: undefined,
          event: undefined,
          providers: [],
        }}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.queryByText(/IMDb/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rotten Tomatoes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/дивляться/)).not.toBeInTheDocument();
    expect(screen.queryByText('Нова серія')).not.toBeInTheDocument();
    expect(screen.queryByText('Варто')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

describe('TopRankTile', () => {
  it('links the title and shows the rank once, leaving the position to the list', () => {
    render(<TopRankTile media={ANDOR} rank={3} />, { wrapper: Wrapper });

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/shows/andor');
    expect(link).toHaveTextContent(/^3Андор/);
  });

  it('shows the IMDb and critics scores under the title', () => {
    render(<TopRankTile media={ANDOR} rank={1} />, { wrapper: Wrapper });

    expect(screen.getByText('Оцінка IMDb 8,3')).toBeInTheDocument();
    expect(screen.getByText('Rotten Tomatoes: 76% критиків')).toBeInTheDocument();
  });
});

describe('ProviderLogos', () => {
  it('shows three services and counts the rest', () => {
    const providers = ['Netflix', 'Megogo', 'Prime', 'Apple TV+', 'Sweet.tv'].map((name) => ({
      id: name,
      name,
    }));
    render(<ProviderLogos providers={providers} />, { wrapper: Wrapper });

    const list = screen.getByRole('list', { name: 'Де дивитись' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(within(list).getByText('ще 2')).toBeInTheDocument();
  });
});
