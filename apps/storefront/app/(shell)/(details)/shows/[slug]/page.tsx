import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { ShowDetailsPage, showDetailsMetadata } from '@/pages/media-details';

interface ShowRouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ShowRouteProps): Promise<Metadata> {
  const { slug } = await params;
  return showDetailsMetadata(slug);
}

export default async function ShowRoute({ params }: ShowRouteProps) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  return <ShowDetailsPage slug={slug} locale={locale} />;
}
