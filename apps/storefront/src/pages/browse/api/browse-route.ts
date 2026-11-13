import { configureStorefrontApi } from '@/shared/api';
import { currentYear } from '@/shared/lib';
import { findBrowseCategory } from '../model/browse-category';
import { BROWSE_FRESHNESS_SECONDS } from '../model/browse-freshness';
import { BROWSE_PAGE_SIZE, parseBrowseState, type BrowseSearchParams } from '../model/browse-state';
import { BROWSE_LIMIT_PARAM, BROWSE_OFFSET_PARAM } from './browse-paging';
import { loadBrowsePage } from './load-browse-page';

const MAX_OFFSET = 10_000;
const STALE_WHILE_REVALIDATE_SECONDS = BROWSE_FRESHNESS_SECONDS * 5;
const SHARED_CACHE_CONTROL = `public, max-age=0, s-maxage=${BROWSE_FRESHNESS_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`;

type Paging = { isValid: true; offset: number; limit: number } | { isValid: false };

function integerParam(searchParams: URLSearchParams, name: string, fallback: number): number {
  const value = searchParams.get(name);
  return value === null ? fallback : Number(value);
}

function parsePaging(searchParams: URLSearchParams): Paging {
  const offset = integerParam(searchParams, BROWSE_OFFSET_PARAM, 0);
  const limit = integerParam(searchParams, BROWSE_LIMIT_PARAM, BROWSE_PAGE_SIZE);
  const isOffsetValid = Number.isInteger(offset) && offset >= 0 && offset <= MAX_OFFSET;
  const isLimitValid = Number.isInteger(limit) && limit >= 1 && limit <= BROWSE_PAGE_SIZE;
  return isOffsetValid && isLimitValid ? { isValid: true, offset, limit } : { isValid: false };
}

function firstValues(searchParams: URLSearchParams): BrowseSearchParams {
  return Object.fromEntries(
    [...new Set(searchParams.keys())].map((name) => [name, searchParams.get(name) ?? undefined]),
  );
}

export async function respondWithBrowsePage(request: Request, slug: string): Promise<Response> {
  configureStorefrontApi();
  const category = findBrowseCategory(slug);
  if (!category) return Response.json({ error: 'Unknown browse category' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const paging = parsePaging(searchParams);
  if (!paging.isValid) return Response.json({ error: 'Invalid paging' }, { status: 400 });

  const state = parseBrowseState(category, firstValues(searchParams), currentYear());

  try {
    const page = await loadBrowsePage({
      category,
      state,
      offset: paging.offset,
      limit: paging.limit,
    });
    return Response.json(page, { headers: { 'Cache-Control': SHARED_CACHE_CONTROL } });
  } catch (error) {
    console.error(`[browse] ${slug} page at offset ${paging.offset} failed to load`, error);
    return Response.json({ error: 'Browse page failed to load' }, { status: 502 });
  }
}
