import type { ImageData } from '../types';

const TMDB_BASE_URL = process.env.IMAGE_PROXY_BASE_URL || 'https://image.tmdb.org/t/p';

type ImageSizes = Record<Exclude<keyof ImageData, 'original'>, string>;

const POSTER_SIZES: ImageSizes = { thumb: 'w154', small: 'w342', medium: 'w500', large: 'w780' };
const BACKDROP_SIZES: ImageSizes = { thumb: 'w300', small: 'w300', medium: 'w780', large: 'w1280' };

const toImageData = (path: string, sizes: ImageSizes): ImageData => ({
  thumb: `${TMDB_BASE_URL}/${sizes.thumb}${path}`,
  small: `${TMDB_BASE_URL}/${sizes.small}${path}`,
  medium: `${TMDB_BASE_URL}/${sizes.medium}${path}`,
  large: `${TMDB_BASE_URL}/${sizes.large}${path}`,
  original: `${TMDB_BASE_URL}/original${path}`,
});

/**
 * Maps TMDB image paths to full URLs with multiple sizes.
 * Shared utility for all modules working with TMDB images.
 */
export class ImageMapper {
  static toPoster(path: string | null): ImageData | null {
    return path ? toImageData(path, POSTER_SIZES) : null;
  }

  static toBackdrop(path: string | null): ImageData | null {
    return path ? toImageData(path, BACKDROP_SIZES) : null;
  }
}
