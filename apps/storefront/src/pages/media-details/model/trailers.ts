import type { MovieDetails } from '@/shared/api';

type Video = NonNullable<MovieDetails['videos']>[number];

export interface Trailer {
  key: string;
  title: string;
}

const TRAILER_LIMIT = 6;
const TRAILER_TYPES = new Set<Video['type']>(['Trailer', 'Teaser']);

export function toTrailers(videos: Video[], primary?: Video | null): Trailer[] {
  const youtube = [primary, ...videos].filter(
    (video): video is Video =>
      video != null && video.site === 'YouTube' && TRAILER_TYPES.has(video.type),
  );
  const unique = new Map(youtube.map((video) => [video.key, video.name.trim()]));
  return [...unique].slice(0, TRAILER_LIMIT).map(([key, title]) => ({ key, title }));
}

export function trailerThumbnailUrl(key: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(key)}/hqdefault.jpg`;
}

export function trailerEmbedUrl(key: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(key)}?autoplay=1&rel=0`;
}
