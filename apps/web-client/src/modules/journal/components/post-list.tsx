'use client';

/**
 * Hybrid layout for journal posts.
 * First post is featured with large card, rest are compact list items.
 */

import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';

import type { JournalPostListItem } from '../types';
import { FeaturedPostCard } from './featured-post-card';
import { PostListItem } from './post-list-item';

export interface PostListProps {
  posts: JournalPostListItem[];
  className?: string;
}

/**
 * Hybrid post list: featured card + compact list.
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

  const [featuredPost, ...restPosts] = posts;

  return (
    <div className={cn('space-y-8', className)}>
      {/* Featured post */}
      <FeaturedPostCard post={featuredPost} />

      {/* Rest of posts as compact list */}
      {restPosts.length > 0 && (
        <div className="divide-y-0">
          {restPosts.map((post) => (
            <PostListItem key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
