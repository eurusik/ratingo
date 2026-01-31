/**
 * On-demand revalidation endpoint.
 *
 * Triggers Next.js ISR cache purge for specified paths.
 * Use this when trending data updates to force fresh content.
 *
 * Security: Requires REVALIDATION_SECRET token in Authorization header.
 *
 * @example
 * POST /api/revalidate
 * Authorization: Bearer <REVALIDATION_SECRET>
 * Body: { "paths": ["/", "/browse/shows-trending"] }
 *
 * # Or revalidate home page only:
 * POST /api/revalidate
 * Authorization: Bearer <REVALIDATION_SECRET>
 * Body: {}
 */

import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET;

interface RevalidateBody {
  paths?: string[];
}

export async function POST(request: NextRequest) {
  // Check secret token
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!REVALIDATION_SECRET || token !== REVALIDATION_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as RevalidateBody;
    const paths = body.paths?.length ? body.paths : ['/'];

    // Revalidate all specified paths
    for (const path of paths) {
      revalidatePath(path);
    }

    return NextResponse.json({
      success: true,
      revalidated: paths,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
