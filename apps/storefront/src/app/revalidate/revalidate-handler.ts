import { timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { mediaRoute } from '@/shared/config';

const MEDIA_TYPES = ['movie', 'show'] as const;

type RevalidatableMediaType = (typeof MEDIA_TYPES)[number];

const SLUG_PATTERN = /^[a-z0-9-]{1,200}$/;
const BEARER_PREFIX = 'Bearer ';

interface RevalidateRequest {
  type: RevalidatableMediaType;
  slug: string;
}

function isMediaType(value: unknown): value is RevalidatableMediaType {
  return MEDIA_TYPES.some((type) => type === value);
}

function isAuthorized(header: string | null, secret: string): boolean {
  if (!header?.startsWith(BEARER_PREFIX)) return false;
  const provided = Buffer.from(header.slice(BEARER_PREFIX.length));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function parseRequest(body: unknown): RevalidateRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { type, slug } = body as Record<string, unknown>;
  if (!isMediaType(type)) return null;
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) return null;
  return { type, slug };
}

export function createRevalidateHandler(secret: string | undefined) {
  return async function POST(request: Request): Promise<Response> {
    if (!secret || !isAuthorized(request.headers.get('authorization'), secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await request.json().catch(() => null);
    const payload = parseRequest(body);
    if (!payload) {
      console.warn('Revalidation rejected an invalid payload', body);
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const path = mediaRoute(payload.type, payload.slug);
    revalidatePath(path);
    return NextResponse.json({ revalidated: path });
  };
}
