import { NextRequest, NextResponse } from 'next/server';
import ky from 'ky';
import { env } from '@/core/config/env';

const imageApi = ky.create({
  prefixUrl: env.API_BASE_URL,
  timeout: 30000,
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  try {
    const response = await imageApi.get(`journal/images/${filename}`);
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }
}
