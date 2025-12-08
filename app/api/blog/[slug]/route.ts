import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { blogPosts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/blog/[slug] - отримати пост за slug
 */
export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;

    const [post] = await db
      .select()
      .from(blogPosts)
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.published, true)))
      .limit(1);

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ post }, { status: 200 });
  } catch (err: unknown) {
    console.error('Failed to fetch blog post:', err);
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 });
  }
}
