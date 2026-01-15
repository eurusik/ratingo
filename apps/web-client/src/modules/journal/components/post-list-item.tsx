'use client';

/**
 * Compact list item for journal posts.
 */

import Link from 'next/link';

import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';

import type { JournalPostListItem } from '../types';
import { PostTypeBadge } from './post-type-badge';

export interface PostListItemProps {
  post: JournalPostListItem;
  className?: string;
}

/**
 * Formats date in short format.
 */
function formatDateShort(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

/**
 * Compact row item for post list.
 * Layout: Date | Title | Type Badge
 *
 * @example
 * <PostListItem post={post} />
 */
export function PostListItem({ post, className }: PostListItemProps) {
  const { locale } = useTranslation();

  return (
    <Link href={`/journal/${post.slug}`} className="block group">
      <article
        className={cn(
          'flex items-center gap-4 sm:gap-6 py-4 sm:py-5 border-b border-border/50',
          'transition-colors hover:bg-accent/30 -mx-4 px-4 sm:-mx-6 sm:px-6',
          className,
        )}
      >
        {/* Date */}
        <time
          dateTime={post.publishedAt.toISOString()}
          className="text-sm text-muted-foreground w-20 sm:w-24 flex-shrink-0"
        >
          {formatDateShort(post.publishedAt, locale)}
        </time>

        {/* Title */}
        <h3 className="flex-1 font-medium group-hover:text-primary transition-colors line-clamp-1">
          {post.title}
        </h3>

        {/* Type Badge */}
        <div className="flex-shrink-0 hidden sm:block">
          <PostTypeBadge type={post.type} />
        </div>
      </article>
    </Link>
  );
}
