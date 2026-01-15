import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  const response = await fetch(`${API_URL}/api/journal/images/${filename}`, {
    headers: {
      'Accept': 'image/*',
    },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: 'Image not found' },
      { status: response.status }
    );
  }

  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'image/png';

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
