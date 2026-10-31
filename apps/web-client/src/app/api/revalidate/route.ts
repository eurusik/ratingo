import { timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

const MEDIA_PATH_PREFIX = {
  movie: '/movies',
  show: '/shows',
} as const;

type RevalidatableMediaType = keyof typeof MEDIA_PATH_PREFIX;

const SLUG_PATTERN = /^[a-z0-9-]{1,200}$/;
const BEARER_PREFIX = 'Bearer ';

interface RevalidateRequest {
  type: RevalidatableMediaType;
  slug: string;
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
  if (typeof type !== 'string' || !Object.hasOwn(MEDIA_PATH_PREFIX, type)) return null;
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) return null;
  return { type: type as RevalidatableMediaType, slug };
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !isAuthorized(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = parseRequest(await request.json().catch(() => null));
  if (!payload) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const path = `${MEDIA_PATH_PREFIX[payload.type]}/${payload.slug}`;
  revalidatePath(path);
  return NextResponse.json({ revalidated: path });
}
