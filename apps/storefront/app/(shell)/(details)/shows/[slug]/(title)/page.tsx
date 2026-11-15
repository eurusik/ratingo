import type { Metadata } from 'next';
import { getRequestLocale, getTrackingHints } from '@/app/entrypoint';
import { ShowDetailsPage, showDetailsMetadata } from '@/pages/media-details';

interface ShowRouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ShowRouteProps): Promise<Metadata> {
  const { slug } = await params;
  return showDetailsMetadata(slug);
}

export default async function ShowRoute({ params }: ShowRouteProps) {
  const [{ slug }, locale, trackingHints] = await Promise.all([
    params,
    getRequestLocale(),
    getTrackingHints(),
  ]);
  return <ShowDetailsPage slug={slug} locale={locale} trackingHints={trackingHints} />;
}
