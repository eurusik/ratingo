'use client';

import type { TrendingMedia } from '@/entities/media';
import { useTranslation } from '@/shared/i18n';
import { MediaRail } from './media-rail';

export type MovieList = 'nowPlaying' | 'newOnDigital';

const SECTION_IDS: Record<MovieList, string> = {
  nowPlaying: 'now-playing',
  newOnDigital: 'new-on-digital',
};

export function MovieListRail({ list, items }: { list: MovieList; items: TrendingMedia[] }) {
  const { dict } = useTranslation();

  if (items.length === 0) return null;

  return <MediaRail id={SECTION_IDS[list]} title={dict.home[list]} items={items} />;
}
