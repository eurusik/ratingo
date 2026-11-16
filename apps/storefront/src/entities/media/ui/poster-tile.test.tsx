import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import type { GridMedia } from '../model/grid-media';
import { PosterTile } from './poster-tile';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
      {children}
    </I18nProvider>
  );
}

const ANDOR: GridMedia = {
  mediaItemId: 'andor-id',
  type: 'show',
  slug: 'andor',
  title: 'Андор',
  year: 2022,
  posterUrl: 'https://image.tmdb.org/t/p/w342/andor.jpg',
  imdbRating: 8.3,
  criticsPercent: 76,
};

describe('PosterTile', () => {
  it('links the poster and title, shows the Ratingo verdict and both outside ratings', () => {
    render(
      <PosterTile
        media={{ ...ANDOR, score: 8.4 }}
        actions={<button type="button">Зберегти</button>}
      />,
      { wrapper: Wrapper },
    );

    const link = screen.getByRole('link', { name: 'Андор' });
    expect(link).toHaveAttribute('href', '/shows/andor');
    expect(link).toHaveAccessibleDescription('8,4 · Варто');
    expect(screen.getByText('Оцінка IMDb 8,3')).toBeInTheDocument();
    expect(screen.getByText('Rotten Tomatoes: 76% критиків')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Зберегти' })).toBeInTheDocument();
  });

  it('leaves out the verdict when the title has no Ratingo score yet', () => {
    render(<PosterTile media={{ ...ANDOR, score: undefined }} />, { wrapper: Wrapper });

    expect(screen.queryByText(/Варто/)).not.toBeInTheDocument();
  });
});
