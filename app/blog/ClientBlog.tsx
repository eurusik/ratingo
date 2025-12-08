'use client';

import { useEffect, useState } from 'react';
import { BlogPostList } from '@/components/blog/BlogPostList';

interface BlogPost {
  id: number;
  slug: string;
  title: string;
  brief: string | null;
  coverImage: string | null;
  tags: string[] | null;
  publishedAt: string | null;
}

export default function ClientBlog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch('/api/blog');
        const data = await res.json();
        setPosts(data.posts || []);
      } catch (err) {
        console.error('Failed to fetch posts:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black">
        <div className="max-w-4xl mx-auto px-4 py-20">
          <div className="animate-pulse space-y-8">
            <div className="h-12 bg-zinc-800 rounded-lg w-1/3" />
            <div className="h-6 bg-zinc-800 rounded-lg w-2/3" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-6 bg-zinc-800/50 rounded-xl space-y-4">
                <div className="h-6 bg-zinc-700 rounded w-3/4" />
                <div className="h-4 bg-zinc-700 rounded w-full" />
                <div className="h-4 bg-zinc-700 rounded w-5/6" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black">
      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Блог Ratingo
          </h1>
          <p className="text-xl text-gray-400">Оновлення, нові фічі та зміни в проєкті</p>
        </div>

        <BlogPostList posts={posts} />
      </div>
    </div>
  );
}
