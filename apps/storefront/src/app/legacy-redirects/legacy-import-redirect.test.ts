import { legacyImportDestination } from './legacy-import-redirect';

function destinationFor(query: Record<string, string>) {
  return legacyImportDestination(new URLSearchParams(query));
}

describe('legacyImportDestination', () => {
  it('opens a show page when the import already has a slug', () => {
    expect(destinationFor({ type: 'show', slug: 'klinika', title: 'Клініка' })).toBe(
      '/shows/klinika',
    );
  });

  it('opens a movie page when the import already has a slug', () => {
    expect(destinationFor({ type: 'movie', slug: 'dune-2021', jobId: 'job-1' })).toBe(
      '/movies/dune-2021',
    );
  });

  it('treats an import without a known type as a movie', () => {
    expect(destinationFor({ slug: 'dune-2021' })).toBe('/movies/dune-2021');
  });

  it('opens the search prefilled with the title when there is no slug', () => {
    expect(destinationFor({ type: 'show', title: 'Клініка & Co', year: '2024' })).toBe(
      `/?q=${encodeURIComponent('Клініка')}+%26+Co`,
    );
  });

  it('ignores a blank slug and falls back to the title search', () => {
    expect(destinationFor({ slug: '  ', title: 'Dune' })).toBe('/?q=Dune');
  });

  it('goes home when neither slug nor title is given', () => {
    expect(destinationFor({ type: 'movie' })).toBe('/');
  });
});
