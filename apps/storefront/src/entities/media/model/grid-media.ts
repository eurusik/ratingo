import type { TrendingMedia } from './media';

export type GridMedia = Pick<
  TrendingMedia,
  | 'mediaItemId'
  | 'type'
  | 'slug'
  | 'title'
  | 'year'
  | 'posterUrl'
  | 'score'
  | 'imdbRating'
  | 'criticsPercent'
>;

export function toGridMedia(media: TrendingMedia): GridMedia {
  return {
    mediaItemId: media.mediaItemId,
    type: media.type,
    slug: media.slug,
    title: media.title,
    year: media.year,
    posterUrl: media.posterUrl,
    score: media.score,
    imdbRating: media.imdbRating,
    criticsPercent: media.criticsPercent,
  };
}
