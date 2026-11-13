import { configureStorefrontApi } from '@/shared/api';
import { findBrowseCategory } from '../model/browse-category';
import { BROWSE_PAGE_SIZE, parseBrowseState } from '../model/browse-state';
import { BROWSE_LIMIT_PARAM, BROWSE_OFFSET_PARAM } from './browse-client';
import { loadBrowsePage } from './load-browse-page';

const MAX_OFFSET = 10_000;
const SHARED_CACHE_CONTROL = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

function boundedInteger(value: string | null, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export async function respondWithBrowsePage(request: Request, slug: string): Promise<Response> {
  configureStorefrontApi();
  const category = findBrowseCategory(slug);
  if (!category) return Response.json({ error: 'Unknown browse category' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const state = parseBrowseState(
    category,
    Object.fromEntries(searchParams),
    new Date().getFullYear(),
  );
  const offset = boundedInteger(searchParams.get(BROWSE_OFFSET_PARAM), 0, MAX_OFFSET, 0);
  const limit = boundedInteger(
    searchParams.get(BROWSE_LIMIT_PARAM),
    1,
    BROWSE_PAGE_SIZE,
    BROWSE_PAGE_SIZE,
  );

  try {
    const page = await loadBrowsePage({ category, state, offset, limit });
    return Response.json(page, { headers: { 'Cache-Control': SHARED_CACHE_CONTROL } });
  } catch (error) {
    console.error(`[browse] ${slug} page at offset ${offset} failed to load`, error);
    return Response.json({ error: 'Browse page failed to load' }, { status: 502 });
  }
}
