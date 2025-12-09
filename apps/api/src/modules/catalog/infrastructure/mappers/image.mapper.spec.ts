import { ImageMapper } from './image.mapper';

describe('ImageMapper', () => {
  it('should map poster path to ImageDto with correct URLs', () => {
    const path = '/abc.jpg';
    const result = ImageMapper.toPoster(path);

    expect(result).not.toBeNull();
    expect(result?.small).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
    expect(result?.medium).toBe('https://image.tmdb.org/t/p/w500/abc.jpg');
    expect(result?.large).toBe('https://image.tmdb.org/t/p/w780/abc.jpg');
    expect(result?.original).toBe('https://image.tmdb.org/t/p/original/abc.jpg');
  });

  it('should map backdrop path to ImageDto with correct URLs', () => {
    const path = '/xyz.jpg';
    const result = ImageMapper.toBackdrop(path);

    expect(result).not.toBeNull();
    expect(result?.small).toBe('https://image.tmdb.org/t/p/w300/xyz.jpg');
    expect(result?.medium).toBe('https://image.tmdb.org/t/p/w780/xyz.jpg');
    expect(result?.large).toBe('https://image.tmdb.org/t/p/w1280/xyz.jpg');
    expect(result?.original).toBe('https://image.tmdb.org/t/p/original/xyz.jpg');
  });

  it('should return null if path is null', () => {
    expect(ImageMapper.toPoster(null)).toBeNull();
    expect(ImageMapper.toBackdrop(null)).toBeNull();
  });
});
