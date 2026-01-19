'use client';

/**
 * Status badge for journal posts (draft/published/scheduled).
 */

import { useTranslation } from '@/shared/i18n';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/utils';

import type { AdminJournalPost, PostStatus } from '../../types';

export interface PostStatusBadgeProps {
  post: AdminJournalPost;
  className?: string;
}

/**
 * Determines post status from draft flag and publishedAt date.
 */
function getPostStatus(post: AdminJournalPost): PostStatus {
  if (post.isDraft) return 'draft';
  if (post.publishedAt && post.publishedAt > new Date()) return 'scheduled';
  return 'published';
}

const STATUS_STYLES: Record<PostStatus, string> = {
  draft: 'bg-zinc-500/20 text-cinema-text-secondary border-zinc-500/30 hover:bg-zinc-500/30',
  published: 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30',
  scheduled: 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30',
};

/**
 * Displays post status (draft/published/scheduled).
 */
export function PostStatusBadge({ post, className }: PostStatusBadgeProps) {
  const { t } = useTranslation();
  const status = getPostStatus(post);

  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status], className)}>
      {t(`admin.journal.status.${status}`)}
    </Badge>
  );
}
