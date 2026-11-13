import type { Metadata } from 'next';
import { MovieDetailsPage, movieDetailsMetadata } from '@/pages/media-details';

interface MovieRouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: MovieRouteProps): Promise<Metadata> {
  const { slug } = await params;
  return movieDetailsMetadata(slug);
}

export default async function MovieRoute({ params }: MovieRouteProps) {
  const { slug } = await params;
  return <MovieDetailsPage slug={slug} />;
}
