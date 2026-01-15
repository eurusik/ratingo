'use client';

/**
 * Full journal post detail view.
 */

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';

import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils';

import type { JournalPost } from '../types';
import { PostTypeBadge } from './post-type-badge';
import { PostNavigationLinks } from './post-navigation';

export interface PostDetailProps {
  post: JournalPost;
  className?: string;
}

/**
 * Formats date for display using the given locale.
 */
function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Full post detail with header, content, and navigation.
 *
 * @example
 * <PostDetail post={post} />
 */
export function PostDetail({ post, className }: PostDetailProps) {
  const { t, locale } = useTranslation();

  return (
    <article className={cn('max-w-none', className)}>
      {/* Back link */}
      <div className="mb-6">
        <Link href="/journal">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('journal.navigation.backToList')}
          </Button>
        </Link>
      </div>

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <PostTypeBadge type={post.type} />
          <time
            dateTime={post.publishedAt.toISOString()}
            className="text-sm text-muted-foreground"
          >
            {formatDate(post.publishedAt, locale)}
          </time>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold mb-6">
          {post.title}
        </h1>

        {post.featuredImageUrl && (
          <div className="relative aspect-video rounded-lg overflow-hidden mb-6">
            <Image
              src={post.featuredImageUrl}
              alt={post.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
        )}
      </header>

      {/* Content */}
      <div
        className="prose prose-invert prose-lg max-w-none mb-12"
        dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
      />

      {/* Navigation */}
      <PostNavigationLinks navigation={post.navigation} className="pt-8 border-t" />
    </article>
  );
}
