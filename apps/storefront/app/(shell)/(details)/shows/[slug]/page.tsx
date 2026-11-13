import type { Metadata } from 'next';
import { ShowDetailsPage, showDetailsMetadata } from '@/pages/media-details';

interface ShowRouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ShowRouteProps): Promise<Metadata> {
  const { slug } = await params;
  return showDetailsMetadata(slug);
}

export default async function ShowRoute({ params }: ShowRouteProps) {
  const { slug } = await params;
  return <ShowDetailsPage slug={slug} />;
}
