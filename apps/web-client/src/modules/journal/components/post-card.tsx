'use client';

/**
 * Card component for displaying a journal post in list view.
 */

import Link from 'next/link';
import Image from 'next/image';

import { useTranslation } from '@/shared/i18n';
import { Card, CardContent } from '@/shared/ui/card';
import { cn } from '@/shared/utils';

import type { JournalPostListItem } from '../types';
import { PostTypeBadge } from './post-type-badge';

export interface PostCardProps {
  post: JournalPostListItem;
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
 * Card displaying a journal post preview.
 *
 * @example
 * <PostCard post={post} />
 */
export function PostCard({ post, className }: PostCardProps) {
  const { locale } = useTranslation();

  return (
    <Link href={`/journal/${post.slug}`} className="block group">
      <Card
        className={cn(
          'overflow-hidden transition-colors hover:bg-accent/50',
          className,
        )}
      >
        {post.featuredImageUrl && (
          <div className="relative aspect-video overflow-hidden">
            <Image
              src={post.featuredImageUrl}
              alt={post.title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        )}
        <CardContent className={cn('p-4', post.featuredImageUrl && 'pt-4')}>
          <div className="flex items-center gap-2 mb-2">
            <PostTypeBadge type={post.type} />
            <time
              dateTime={post.publishedAt.toISOString()}
              className="text-xs text-muted-foreground"
            >
              {formatDate(post.publishedAt, locale)}
            </time>
          </div>
          <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {post.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {post.excerpt}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
