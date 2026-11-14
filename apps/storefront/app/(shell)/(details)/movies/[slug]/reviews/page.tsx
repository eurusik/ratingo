import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { MediaReviewsPage, reviewsMetadata } from '@/pages/media-reviews';

interface ReviewsRouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ReviewsRouteProps): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  return reviewsMetadata('movie', slug, locale);
}

export default async function ReviewsRoute({ params }: ReviewsRouteProps) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  return <MediaReviewsPage type="movie" slug={slug} locale={locale} />;
}
