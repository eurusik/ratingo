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
});
