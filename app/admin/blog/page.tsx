import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PostsList } from '@/components/admin/blog/PostsList';
import { Plus } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { LogoutButton } from '@/components/admin/LogoutButton';

async function getPosts() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window === 'undefined' ? 'http://localhost:3000' : '');
  const res = await fetch(`${baseUrl}/api/admin/blog`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch posts');
  }

  const data = await res.json();
  return data.posts;
}

export default async function AdminBlogPage() {
  await requireAuth();
  const posts = await getPosts();

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black">
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Керування блогом
            </h1>
            <p className="text-gray-400">Всього постів: {posts.length}</p>
          </div>
          <div className="flex gap-3">
            <LogoutButton />
            <Link href="/admin/blog/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Новий пост
              </Button>
            </Link>
          </div>
        </div>

        <PostsList posts={posts} />
      </div>
    </div>
  );
}
