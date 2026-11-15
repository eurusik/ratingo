import type { Metadata } from 'next';
import type { MediaType } from '@/shared/api';
import { mediaReviewsRoute } from '@/shared/config';
import { getDictionary, interpolate, type Locale } from '@/shared/i18n';
import { loadReviewsSubject } from './load-reviews-subject';

export async function reviewsMetadata(
  type: MediaType,
  slug: string,
  locale: Locale,
): Promise<Metadata> {
  const { media } = await loadReviewsSubject(type, slug);
  const dict = getDictionary(locale).reviews;
  return {
    title: interpolate(dict.pageTitle, { title: media.title }),
    description: interpolate(dict.metaDescription, { title: media.title }),
    alternates: { canonical: mediaReviewsRoute(type, media.slug) },
  };
}
