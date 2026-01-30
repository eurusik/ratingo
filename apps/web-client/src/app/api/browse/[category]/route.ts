/**
 * API route for browse pagination.
 * Used by infinite scroll to load more items.
 */

import { NextRequest, NextResponse } from 'next/server';
import { catalogApi } from '@/core/api';
import { getCategoryConfig, CATALOG_SORT_OPTIONS, type CatalogSort } from '@/modules/browse';

function validateSort(value: string | null): CatalogSort | undefined {
  if (!value) return undefined;
  return (CATALOG_SORT_OPTIONS as readonly string[]).includes(value)
    ? (value as CatalogSort)
    : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> },
) {
  const { category } = await params;
  const config = getCategoryConfig(category);

  if (!config) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || String(config.pageSize), 10);
  const sort = validateSort(searchParams.get('sort'));
  const offset = (page - 1) * limit;

  try {
    // Call the appropriate API method based on category config
    const apiMethod = catalogApi[config.apiMethod];
    const params: Record<string, string | number | undefined> = { offset, limit };
    if (sort) params.sort = sort;

    const response = (await apiMethod(params as Parameters<typeof apiMethod>[0])) as unknown as {
      data: Array<{
        id: string;
        slug: string;
        title: string;
        poster?: { small: string; medium: string; large: string; original: string } | null;
        stats?: { qualityScore?: number | null; liveWatchers?: number | null } | null;
        externalRatings?: {
          imdb?: { rating: number } | null;
          tmdb?: { rating: number } | null;
        } | null;
        releaseDate?: string | null;
      }>;
      meta: { total?: number };
    };

    const items = response.data.map((item) => ({
      id: item.id,
      slug: item.slug,
      type: config.mediaType,
      title: item.title,
      poster: item.poster ?? null,
      stats: item.stats ?? null,
      externalRatings: item.externalRatings ?? null,
      releaseDate: item.releaseDate ?? null,
    }));

    const total = response.meta.total ?? 0;

    return NextResponse.json({
      items,
      total,
      hasMore: page * limit < total,
    });
  } catch (error) {
    console.error('Browse API error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
