'use client';

/**
 * Grid layout for journal posts.
 */

import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';

import type { JournalPostListItem } from '../types';
import { PostCard } from './post-card';

export interface PostListProps {
  posts: JournalPostListItem[];
  className?: string;
}

/**
 * Responsive grid of post cards.
 *
 * @example
 * <PostList posts={posts} />
 */
export function PostList({ posts, className }: PostListProps) {
  const { t } = useTranslation();

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('journal.empty')}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-6 sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
