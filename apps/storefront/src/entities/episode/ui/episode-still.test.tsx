import { render } from '@testing-library/react';
import { EpisodeStill } from './episode-still';

const EPISODE = { seasonNumber: 2, number: 4 };

function imageSource(container: HTMLElement): string | null {
  return container.querySelector('img')?.getAttribute('src') ?? null;
}

describe('EpisodeStill', () => {
  it('prefers the episode still', () => {
    const { container } = render(
      <EpisodeStill
        episode={{ ...EPISODE, stillPath: '/still.jpg' }}
        badge="С2 · Е4"
        size="row"
        fallbackPosterPath="/poster.jpg"
      />,
    );
    expect(imageSource(container)).toContain('/w300/still.jpg');
  });

  it('falls back to the show poster when the episode has no still', () => {
    const { container } = render(
      <EpisodeStill
        episode={EPISODE}
        badge="С2 · Е4"
        size="row"
        fallbackPosterPath="/poster.jpg"
      />,
    );
    expect(imageSource(container)).toContain('/w342/poster.jpg');
  });

  it('shows only the badge when there is no image at all', () => {
    const { container, getByText } = render(
      <EpisodeStill episode={EPISODE} badge="С2 · Е4" size="row" />,
    );
    expect(imageSource(container)).toBeNull();
    expect(getByText('С2 · Е4')).toBeInTheDocument();
  });
});
