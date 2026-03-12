/**
 * Journal post detail page.
 * Displays full post content with navigation.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/shared/i18n';
import { getJournalPost } from '@/core/api/journal.server';
import { JsonLd, createCanonical, SEO_BASE_URL } from '@/shared/utils/seo';
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
      title: dict.errors.notFound,
    };
  }

  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt;

  return {
    title: `${title} | ${dict.journal.title}`,
    description,
    ...createCanonical(`/journal/${post.slug}`),
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

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Головна', item: SEO_BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Журнал', item: `${SEO_BASE_URL}/journal` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${SEO_BASE_URL}/journal/${post.slug}` },
    ],
  };

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.metaDescription ?? post.excerpt ?? undefined,
    image: post.featuredImageUrl ?? undefined,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: {
      '@type': 'Organization',
      name: 'Ratingo',
      url: SEO_BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Ratingo',
      logo: { '@type': 'ImageObject', url: `${SEO_BASE_URL}/icon.png` },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SEO_BASE_URL}/journal/${post.slug}`,
    },
  };

  return (
    <div className="min-h-screen bg-cinema-page">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={articleJsonLd} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <JournalPostPageClient post={post} />
      </div>
    </div>
  );
}
