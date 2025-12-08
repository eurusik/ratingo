import { notFound } from 'next/navigation';
import { PostForm } from '@/components/admin/blog/PostForm';
import { db } from '@/db';
import { blogPosts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';

async function getPost(id: number) {
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);

  return post;
}

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const postId = parseInt(id, 10);

  if (isNaN(postId)) {
    notFound();
  }

  const post = await getPost(postId);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black">
      <div className="max-w-4xl mx-auto px-4 py-20">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Редагувати пост
        </h1>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <PostForm
            mode="edit"
            initialData={{
              id: post.id,
              slug: post.slug,
              title: post.title,
              brief: post.brief,
              content: post.content,
              coverImage: post.coverImage,
              tags: post.tags as string[] | null,
              published: post.published,
            }}
          />
        </div>
      </div>
    </div>
  );
}
