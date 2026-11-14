import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { MediaReviewsPage, reviewsMetadata } from '@/pages/media-reviews';

interface ReviewsRouteProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string | string[] }>;
}

export async function generateMetadata({ params }: ReviewsRouteProps): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  return reviewsMetadata('show', slug, locale);
}

export default async function ReviewsRoute({ params, searchParams }: ReviewsRouteProps) {
  const [{ slug }, { sort }, locale] = await Promise.all([
    params,
    searchParams,
    getRequestLocale(),
  ]);
  return <MediaReviewsPage type="show" slug={slug} sort={typeof sort === 'string' ? sort : undefined} locale={locale} />;
}
