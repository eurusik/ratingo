'use client';

/**
 * Featured post card - large card with image for the latest post.
 */

import Link from 'next/link';
import Image from 'next/image';

import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';

import type { JournalPostListItem } from '../types';
import { PostTypeBadge } from './post-type-badge';

export interface FeaturedPostCardProps {
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
 * Large featured card for the most recent post.
 *
 * @example
 * <FeaturedPostCard post={latestPost} />
 */
export function FeaturedPostCard({ post, className }: FeaturedPostCardProps) {
  const { locale } = useTranslation();

  return (
    <Link href={`/journal/${post.slug}`} className="block group">
      <article
        className={cn(
          'rounded-lg overflow-hidden bg-card border transition-colors hover:bg-accent/30',
          className,
        )}
      >
        {post.featuredImageUrl && (
          <div className="relative aspect-[21/9] overflow-hidden">
            <Image
              src={post.featuredImageUrl}
              alt={post.title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 1200px"
              priority
            />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <PostTypeBadge type={post.type} />
            <span className="text-muted-foreground">•</span>
            <time
              dateTime={post.publishedAt.toISOString()}
              className="text-sm text-muted-foreground"
            >
              {formatDate(post.publishedAt, locale)}
            </time>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 group-hover:text-primary transition-colors">
            {post.title}
          </h2>
          <p className="text-muted-foreground line-clamp-2 text-base">
            {post.excerpt}
          </p>
        </div>
      </article>
    </Link>
  );
}
