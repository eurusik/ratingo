import type { ImageData } from '../../domain/types/common.types';

const TMDB_BASE_URL = 'https://image.tmdb.org/t/p';

export class ImageMapper {
  static toPoster(path: string | null): ImageData | null {
    if (!path) return null;
    return {
      small: `${TMDB_BASE_URL}/w342${path}`,
      medium: `${TMDB_BASE_URL}/w500${path}`,
      large: `${TMDB_BASE_URL}/w780${path}`,
      original: `${TMDB_BASE_URL}/original${path}`,
    };
  }

  static toBackdrop(path: string | null): ImageData | null {
    if (!path) return null;
    return {
      small: `${TMDB_BASE_URL}/w300${path}`,
      medium: `${TMDB_BASE_URL}/w780${path}`,
      large: `${TMDB_BASE_URL}/w1280${path}`,
      original: `${TMDB_BASE_URL}/original${path}`,
    };
  }
}
