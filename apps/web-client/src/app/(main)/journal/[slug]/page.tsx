/**
 * Journal post detail page.
 * Displays full post content with navigation.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/shared/i18n';
import { getJournalPost } from '@/core/api/journal.server';
import { JournalPostPageClient } from './client';

// ISR: Revalidate every 10 minutes
export const revalidate = 600;

interface PageParams {
  params: Promise<{ slug: string }>;
}

/**
 * Dynamic metadata for SEO.
 */
export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const post = await getJournalPost(slug);
  const dict = getDictionary('uk');

  if (!post) {
    return {
      title: `${dict.errors.notFound} | Ratingo`,
    };
  }

  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt;

  return {
    title: `${title} | ${dict.journal.title} | Ratingo`,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: post.publishedAt,
      images: post.featuredImageUrl ? [post.featuredImageUrl] : undefined,
    },
  };
}

export default async function JournalPostPage({ params }: PageParams) {
  const { slug } = await params;
  const post = await getJournalPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <JournalPostPageClient post={post} />
      </div>
    </div>
  );
}
