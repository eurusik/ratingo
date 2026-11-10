/**
 * TMDB image URL constants.
 * @see https://developer.themoviedb.org/docs/image-basics
 * @deprecated Use resolveMediaImageUrl from '@/shared/utils' instead
 */

import { resolveMediaImageUrl, IMAGE_SIZES } from '../utils/image';

/** @deprecated Use IMAGE_SIZES from '@/shared/utils' */
export const TMDB_POSTER_SIZES = IMAGE_SIZES;

/** @deprecated Use resolveMediaImageUrl from '@/shared/utils' */
export const tmdbImageUrl = resolveMediaImageUrl;
