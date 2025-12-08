'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BlogPostSkeleton } from '@/components/blog/atoms/BlogPostSkeleton';
import { BlogPostNotFound } from '@/components/blog/atoms/BlogPostNotFound';
import { BackToBlogLink } from '@/components/blog/atoms/BackToBlogLink';
import { BlogPostHeader } from '@/components/blog/BlogPostHeader';
import { BlogPostContent } from '@/components/blog/BlogPostContent';

interface BlogPost {
  id: number;
  slug: string;
  title: string;
  brief: string | null;
  content: string;
  coverImage: string | null;
  tags: string[] | null;
  publishedAt: string | null;
}

export default function ClientBlogPost() {
  const params = useParams();
  const slug = params.slug as string;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchPost() {
      try {
        const res = await fetch(`/api/blog/${slug}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setPost(data.post);
      } catch (err) {
        console.error('Failed to fetch post:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchPost();
    }
  }, [slug]);

  if (loading) {
    return <BlogPostSkeleton />;
  }

  if (notFound || !post) {
    return <BlogPostNotFound />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black">
      <div className="max-w-4xl mx-auto px-4 py-20">
        <BackToBlogLink className="mb-8" />

        <article>
          <BlogPostHeader
            title={post.title}
            coverImage={post.coverImage}
            publishedAt={post.publishedAt}
            tags={post.tags}
          />

          <BlogPostContent content={post.content} />
        </article>

        <div className="mt-12 pt-8 border-t border-zinc-800">
          <BackToBlogLink />
        </div>
      </div>
    </div>
  );
}
