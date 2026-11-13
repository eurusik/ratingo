import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getRequestLocale } from '@/app/entrypoint';
import {
  BROWSE_CATEGORY_SLUGS,
  BrowsePage,
  browseMetadata,
  findBrowseCategory,
  type BrowseSearchParams,
} from '@/pages/browse';

export const dynamicParams = false;

interface BrowseCategoryRouteProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<BrowseSearchParams>;
}

export function generateStaticParams() {
  return BROWSE_CATEGORY_SLUGS.map((category) => ({ category }));
}

export async function generateMetadata({ params }: BrowseCategoryRouteProps): Promise<Metadata> {
  const [{ category: slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const category = findBrowseCategory(slug);
  return category ? browseMetadata(locale, category.slug) : {};
}

export default async function BrowseCategoryRoute({
  params,
  searchParams,
}: BrowseCategoryRouteProps) {
  const [{ category: slug }, query] = await Promise.all([params, searchParams]);
  const category = findBrowseCategory(slug);
  if (!category) notFound();

  return <BrowsePage category={category} searchParams={query} />;
}
