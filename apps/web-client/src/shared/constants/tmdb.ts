/**
 * TMDB image URL constants.
 * @see https://developer.themoviedb.org/docs/image-basics
 * @deprecated Use resolveMediaImageUrl from '@/shared/utils' instead
 */

import { resolveMediaImageUrl, IMAGE_SIZES, MEDIA_IMAGE_BASE } from '../utils/image';

/** @deprecated Use MEDIA_IMAGE_BASE from '@/shared/utils' */
export const TMDB_IMAGE_BASE = MEDIA_IMAGE_BASE;

/** @deprecated Use IMAGE_SIZES from '@/shared/utils' */
export const TMDB_POSTER_SIZES = IMAGE_SIZES;

/** @deprecated Use resolveMediaImageUrl from '@/shared/utils' */
export const tmdbImageUrl = resolveMediaImageUrl;
