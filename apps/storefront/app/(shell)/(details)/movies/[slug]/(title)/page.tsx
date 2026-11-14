import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import { MovieDetailsPage, movieDetailsMetadata } from '@/pages/media-details';

interface MovieRouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: MovieRouteProps): Promise<Metadata> {
  const { slug } = await params;
  return movieDetailsMetadata(slug);
}

export default async function MovieRoute({ params }: MovieRouteProps) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  return <MovieDetailsPage slug={slug} locale={locale} />;
}
