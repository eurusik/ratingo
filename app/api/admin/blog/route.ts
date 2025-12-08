import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { blogPosts } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * GET /api/admin/blog - отримати всі пости (включно з чернетками)
 */
export async function GET(req: NextRequest) {
  try {
    const posts = await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));

    return NextResponse.json({ posts }, { status: 200 });
  } catch (err: unknown) {
    console.error('Failed to fetch all blog posts:', err);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

/**
 * POST /api/admin/blog - створити новий пост
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, title, brief, content, coverImage, tags, published } = body;

    if (!slug || !title || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: slug, title, content' },
        { status: 400 }
      );
    }

    // Перевірка чи slug унікальний
    const [existing] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);

    if (existing) {
      return NextResponse.json({ error: 'Post with this slug already exists' }, { status: 409 });
    }

    const [newPost] = await db
      .insert(blogPosts)
      .values({
        slug,
        title,
        brief: brief || null,
        content,
        coverImage: coverImage || null,
        tags: tags || null,
        published: published || false,
        publishedAt: published ? new Date() : null,
      })
      .returning();

    return NextResponse.json({ post: newPost }, { status: 201 });
  } catch (err: unknown) {
    console.error('Failed to create blog post:', err);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/blog - оновити існуючий пост
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, slug, title, brief, content, coverImage, tags, published } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (slug !== undefined) updateData.slug = slug;
    if (title !== undefined) updateData.title = title;
    if (brief !== undefined) updateData.brief = brief;
    if (content !== undefined) updateData.content = content;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (tags !== undefined) updateData.tags = tags;
    if (published !== undefined) {
      updateData.published = published;
      // Якщо публікуємо вперше, встановлюємо publishedAt
      if (published) {
        const [current] = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
        if (current && !current.publishedAt) {
          updateData.publishedAt = new Date();
        }
      }
    }

    const [updatedPost] = await db
      .update(blogPosts)
      .set(updateData)
      .where(eq(blogPosts.id, id))
      .returning();

    if (!updatedPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ post: updatedPost }, { status: 200 });
  } catch (err: unknown) {
    console.error('Failed to update blog post:', err);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/blog - видалити пост
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required parameter: id' }, { status: 400 });
    }

    const [deletedPost] = await db
      .delete(blogPosts)
      .where(eq(blogPosts.id, parseInt(id, 10)))
      .returning();

    if (!deletedPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Post deleted successfully' }, { status: 200 });
  } catch (err: unknown) {
    console.error('Failed to delete blog post:', err);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
