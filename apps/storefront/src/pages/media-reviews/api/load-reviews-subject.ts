import { notFound } from 'next/navigation';
import { loadMovieBySlug, loadShowBySlug, type MediaType } from '@/shared/api';
import { toReviewsSubject, type ReviewsSubject } from '../model/reviews-subject';

export async function loadReviewsSubject(type: MediaType, slug: string): Promise<ReviewsSubject> {
  const details = type === 'movie' ? await loadMovieBySlug(slug) : await loadShowBySlug(slug);
  if (!details) notFound();
  return toReviewsSubject(details, type);
}
