'use client';

import { Trash2, Reply } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uk, enUS } from 'date-fns/locale';
import { cn } from '@/shared/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/ui';

const DATE_LOCALES = { uk, en: enUS } as const;

interface ReplyAuthor {
  id: string;
  username: string;
  avatarUrl?: string | null;
}

interface ReplyCardProps {
  id: string;
  author: ReplyAuthor;
  content: string;
  replyToUsername?: string | null;
  createdAt: string | Date;
  locale: 'uk' | 'en';
  /** Whether this reply belongs to current user */
  isOwn: boolean;
  /** Whether user is authenticated (for showing reply button) */
  isAuthenticated: boolean;
  /** Whether this card is highlighted (being replied to) */
  isHighlighted?: boolean;
  /** Visual variant - affects background opacity */
  variant?: 'default' | 'nested';
  /** Translations dictionary */
  replyLabel: string;
  /** Callbacks */
  onReply?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

/**
 * Single reply card UI.
 * Displays author info, content, and action buttons.
 */
export function ReplyCard({
  author,
  content,
  replyToUsername,
  createdAt,
  locale,
  isOwn,
  isAuthenticated,
  isHighlighted = false,
  variant = 'default',
  replyLabel,
  onReply,
  onDelete,
  isDeleting = false,
}: ReplyCardProps) {
  const timeAgo = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
    locale: DATE_LOCALES[locale],
  });

  const bgClass = variant === 'nested' ? 'bg-cinema-card/20' : 'bg-cinema-card/30';
  const highlightBgClass = variant === 'nested' ? 'bg-cinema-card/40' : 'bg-cinema-card/50';

  return (
    <div
      className={cn(
        'group rounded-lg p-3 transition-all duration-200',
        bgClass,
        isHighlighted && `ring-1 ring-zinc-600 ${highlightBgClass}`,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            {author.avatarUrl && (
              <AvatarImage src={author.avatarUrl} alt={author.username} />
            )}
            <AvatarFallback className="bg-cinema-elevated text-zinc-400 text-xs">
              {author.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-zinc-300">{author.username}</span>
          <span className="text-xs text-zinc-600">{timeAgo}</span>
        </div>

        {/* Delete button - visible on hover */}
        {isOwn && onDelete && (
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className={cn(
              'text-zinc-600 hover:text-red-400 transition-all',
              'opacity-0 group-hover:opacity-100',
              isDeleting && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-zinc-300 leading-relaxed break-words">
        {replyToUsername && (
          <span className="text-zinc-500 mr-1 whitespace-nowrap">↪ @{replyToUsername}</span>
        )}
        {content}
      </p>

      {/* Reply button */}
      {isAuthenticated && !isOwn && onReply && (
        <button
          onClick={onReply}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mt-2"
        >
          <Reply className="w-3 h-3" />
          {replyLabel}
        </button>
      )}
    </div>
  );
}
