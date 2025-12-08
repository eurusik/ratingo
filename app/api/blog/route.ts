import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { blogPosts } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

/**
 * GET /api/blog - отримати всі опубліковані пости
 */
export async function GET(req: NextRequest) {
  try {
    const posts = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.published, true))
      .orderBy(desc(blogPosts.publishedAt));

    return NextResponse.json({ posts }, { status: 200 });
  } catch (err: unknown) {
    console.error('Failed to fetch blog posts:', err);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
