import type { MovieDetails } from '@/shared/api';
import { toTrailers } from './trailers';

type Video = NonNullable<MovieDetails['videos']>[number];

function video(key: string, overrides: Partial<Video> = {}): Video {
  return {
    key,
    name: `Трейлер ${key}`,
    site: 'YouTube',
    type: 'Trailer',
    official: true,
    language: 'uk',
    country: 'UA',
    ...overrides,
  };
}

describe('toTrailers', () => {
  it('puts the primary trailer first and lists each video once', () => {
    const trailers = toTrailers([video('a'), video('b')], video('b'));
    expect(trailers.map(({ key }) => key)).toEqual(['b', 'a']);
  });

  it('keeps only YouTube trailers and teasers', () => {
    const trailers = toTrailers(
      [
        video('clip', { type: 'Clip' }),
        video('vimeo', { site: 'Vimeo' }),
        video('teaser', { type: 'Teaser' }),
      ],
      null,
    );
    expect(trailers.map(({ key }) => key)).toEqual(['teaser']);
  });

  it('shows at most six trailers', () => {
    const many = Array.from({ length: 9 }, (_, index) => video(String(index)));
    expect(toTrailers(many)).toHaveLength(6);
  });
});
