export {};

const ORIGINAL_ENV = process.env;

const TVMAZE_STILL = 'https://static.tvmaze.com/uploads/images/original_untouched/614/1535845.jpg';

function loadImages(proxyOrigin?: string): typeof import('./images') {
  process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_IMAGE_PROXY_ORIGIN: proxyOrigin };
  let images: typeof import('./images') | undefined;
  jest.isolateModules(() => {
    images = jest.requireActual<typeof import('./images')>('./images');
  });
  return images as typeof import('./images');
}

describe('media image urls', () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it.each([TVMAZE_STILL, TVMAZE_STILL.replace('https://', 'http://')])(
    'routes the TVMaze image %s through the image proxy',
    (stillPath) => {
      const images = loadImages('https://img.ratingo.top/');

      expect(images.tmdbStillUrl(stillPath)).toBe(
        'https://img.ratingo.top/tvmaze/original_untouched/614/1535845.jpg',
      );
      expect(images.tmdbPosterUrl(stillPath, 'w342')).toBe(
        'https://img.ratingo.top/tvmaze/original_untouched/614/1535845.jpg',
      );
    },
  );

  it('routes TMDB paths through the image proxy', () => {
    const images = loadImages('https://img.ratingo.top');

    expect(images.tmdbStillUrl('/still.jpg')).toBe('https://img.ratingo.top/tmdb/w300/still.jpg');
    expect(images.tmdbPosterUrl('/poster.jpg', 'w154')).toBe(
      'https://img.ratingo.top/tmdb/w154/poster.jpg',
    );
  });

  it('keeps TVMaze and TMDB origins when no proxy is configured', () => {
    const images = loadImages(undefined);

    expect(images.tmdbStillUrl(TVMAZE_STILL)).toBe(TVMAZE_STILL);
    expect(images.tmdbStillUrl('/still.jpg')).toBe('https://image.tmdb.org/t/p/w300/still.jpg');
  });

  it('leaves other absolute urls untouched', () => {
    const images = loadImages('https://img.ratingo.top');
    const other = 'https://cdn.example.com/poster.jpg';

    expect(images.tmdbPosterUrl(other, 'w342')).toBe(other);
  });

  it('offers the proxied TMDB poster in the requested widths', () => {
    const images = loadImages('https://img.ratingo.top');

    expect(
      images.tmdbPosterSrcSet('https://img.ratingo.top/tmdb/w342/poster.jpg', ['w154', 'w185']),
    ).toBe(
      'https://img.ratingo.top/tmdb/w154/poster.jpg 154w, https://img.ratingo.top/tmdb/w185/poster.jpg 185w',
    );
  });

  it('offers direct TMDB posters in the requested widths', () => {
    const images = loadImages(undefined);

    expect(images.tmdbPosterSrcSet('https://image.tmdb.org/t/p/original/poster.jpg', ['w92'])).toBe(
      'https://image.tmdb.org/t/p/w92/poster.jpg 92w',
    );
  });

  it('offers no widths for posters TMDB does not resize', () => {
    const images = loadImages('https://img.ratingo.top');

    expect(images.tmdbPosterSrcSet(TVMAZE_STILL, ['w154'])).toBeUndefined();
  });

  it('offers no widths without a poster', () => {
    const images = loadImages('https://img.ratingo.top');

    expect(images.tmdbPosterSrcSet(undefined, ['w154'])).toBeUndefined();
  });

  it('exposes the image host origin for preconnecting', () => {
    expect(loadImages('https://img.ratingo.top/').IMAGE_HOST_ORIGIN).toBe('https://img.ratingo.top');
    expect(loadImages(undefined).IMAGE_HOST_ORIGIN).toBe('https://image.tmdb.org');
  });
});
