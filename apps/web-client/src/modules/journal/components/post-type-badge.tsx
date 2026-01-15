'use client';

/**
 * Badge displaying post type with appropriate color.
 */

import { Sparkles, BookOpen, Wrench, Map } from 'lucide-react';

import { useTranslation } from '@/shared/i18n';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/utils';

import type { PostType } from '../types';

export interface PostTypeBadgeProps {
  type: PostType;
  className?: string;
}

/**
 * Configuration for each post type (icons and colors).
 */
const POST_TYPE_CONFIG: Record<
  PostType,
  {
    icon: typeof Sparkles;
    className: string;
  }
> = {
  update: {
    icon: Sparkles,
    className: 'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30',
  },
  explanation: {
    icon: BookOpen,
    className: 'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30',
  },
  fix: {
    icon: Wrench,
    className: 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30',
  },
  roadmap: {
    icon: Map,
    className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30',
  },
};

/**
 * Displays a colored badge for post type.
 *
 * @example
 * <PostTypeBadge type="update" />
 */
export function PostTypeBadge({ type, className }: PostTypeBadgeProps) {
  const { t } = useTranslation();
  const config = POST_TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn('gap-1.5', config.className, className)}>
      <Icon className="w-3.5 h-3.5" />
      {t(`journal.postTypes.${type}`)}
    </Badge>
  );
}
