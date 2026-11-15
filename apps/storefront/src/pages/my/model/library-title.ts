import type { CalendarEpisode, MediaType, SavedItem, UserMediaState } from '@/shared/api';
import { tmdbStillUrl } from '@/shared/config';
import { scoreFromPercent, yearFromDate } from '@/shared/lib';

export interface LibraryTitle {
  mediaItemId: string;
  type: MediaType;
  slug: string;
  title: string;
  imageUrl?: string;
  year?: number;
  releaseDate?: string;
  score?: number;
}

type Summary = NonNullable<UserMediaState['mediaSummary']> | SavedItem['mediaSummary'];

export function titleOf(mediaItemId: string, summary: Summary): LibraryTitle {
  return {
    mediaItemId,
    type: summary.type,
    slug: summary.slug,
    title: summary.title,
    imageUrl: summary.poster?.medium,
    year: yearFromDate(summary.releaseDate),
    releaseDate: summary.releaseDate ?? undefined,
    score: scoreFromPercent(summary.qualityScore),
  };
}

export function titleOfEpisode(episode: CalendarEpisode): LibraryTitle {
  return {
    mediaItemId: episode.showId,
    type: 'show',
    slug: episode.showSlug,
    title: episode.showTitle,
    imageUrl: tmdbStillUrl(episode.stillPath) ?? undefined,
  };
}
