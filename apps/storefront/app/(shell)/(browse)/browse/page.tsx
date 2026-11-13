import type { Metadata } from 'next';
import { getRequestLocale } from '@/app/entrypoint';
import {
  BrowsePage,
  DEFAULT_BROWSE_CATEGORY,
  browseMetadata,
  type BrowseSearchParams,
} from '@/pages/browse';

interface BrowseRouteProps {
  searchParams: Promise<BrowseSearchParams>;
}

export async function generateMetadata(): Promise<Metadata> {
  return browseMetadata(await getRequestLocale(), DEFAULT_BROWSE_CATEGORY.slug);
}

export default async function BrowseRoute({ searchParams }: BrowseRouteProps) {
  return <BrowsePage category={DEFAULT_BROWSE_CATEGORY} searchParams={await searchParams} />;
}
