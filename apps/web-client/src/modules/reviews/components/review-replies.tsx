'use client';

import { useState, useMemo } from 'react';
import { MessageCircle, ChevronDown, ChevronUp, Trash2, Reply } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uk, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import type { ReplyResponseDto } from '@/core/api/reviews.client';
import { useReplies, useCreateReply, useDeleteReply } from '@/core/query/reviews';
import { useTranslation, useLocale } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/ui';
import { ReviewReplyForm } from './review-reply-form';

const DATE_LOCALES = { uk, en: enUS } as const;

interface ReviewRepliesProps {
  reviewId: string;
  mediaItemId: string;
  repliesCount: number;
  isAuthenticated?: boolean;
  currentUserId?: string;
}

export function ReviewReplies({
  reviewId,
  mediaItemId,
  repliesCount,
  isAuthenticated = false,
  currentUserId,
}: ReviewRepliesProps) {
  const { dict } = useTranslation();
  const locale = useLocale();

  const [isExpanded, setIsExpanded] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);

  const { data: replies, isLoading } = useReplies(reviewId, {
    enabled: isExpanded && repliesCount > 0,
  });

  const createReply = useCreateReply(reviewId, mediaItemId);
  const deleteReply = useDeleteReply(reviewId, mediaItemId);

  // Build nested structure from flat list
  const nestedReplies = useMemo(() => {
    const topLevel: ReplyResponseDto[] = [];
    const childrenMap = new Map<string, ReplyResponseDto[]>();

    if (!replies) return { topLevel, childrenMap };

    // Group replies by parent
    for (const reply of replies) {
      if (!reply.parentReplyId) {
        topLevel.push(reply);
      } else {
        const siblings = childrenMap.get(reply.parentReplyId) || [];
        siblings.push(reply);
        childrenMap.set(reply.parentReplyId, siblings);
      }
    }

    return { topLevel, childrenMap };
  }, [replies]);

  const handleCreateReply = async (content: string, parentReplyId?: string) => {
    try {
      await createReply.mutateAsync({ content, parentReplyId });
      toast.success(dict.reviews.replies.toast.created);
      setReplyingTo(null);
    } catch {
      toast.error(dict.reviews.replies.toast.createError);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    try {
      await deleteReply.mutateAsync(replyId);
      toast.success(dict.reviews.replies.toast.deleted);
    } catch {
      toast.error(dict.reviews.replies.toast.deleteError);
    }
  };

  // Don't show section if no replies and not authenticated
  if (repliesCount === 0 && !isAuthenticated) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-zinc-800/30">
      {/* Toggle button */}
      {repliesCount > 0 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-3"
        >
          <MessageCircle className="w-4 h-4" />
          <span>
            {isExpanded ? dict.reviews.replies.hideReplies : dict.reviews.replies.showReplies}
          </span>
          <span className="text-zinc-600">({repliesCount})</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Replies list */}
      {isExpanded && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-sm text-zinc-500 animate-pulse">
              {dict.reviews.replies.title}...
            </div>
          ) : replies && replies.length > 0 ? (
            <div className="space-y-2">
              {nestedReplies.topLevel.map((reply) => (
                <ReplyItem
                  key={reply.id}
                  reply={reply}
                  children={nestedReplies.childrenMap.get(reply.id)}
                  locale={locale}
                  dict={dict}
                  currentUserId={currentUserId}
                  isAuthenticated={isAuthenticated}
                  onReply={(id, username) => setReplyingTo({ id, username })}
                  onDelete={handleDeleteReply}
                  isDeleting={deleteReply.isPending}
                  replyingToId={replyingTo?.id}
                  onCreateReply={handleCreateReply}
                  isCreating={createReply.isPending}
                  onCancelReply={() => setReplyingTo(null)}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-500">{dict.reviews.replies.empty}</div>
          )}
        </div>
      )}

      {/* New reply form (top level) */}
      {isAuthenticated && !replyingTo && (
        <div className="mt-3">
          <ReviewReplyForm
            onSubmit={handleCreateReply}
            isSubmitting={createReply.isPending}
          />
        </div>
      )}
    </div>
  );
}

interface ReplyItemProps {
  reply: ReplyResponseDto;
  children?: ReplyResponseDto[];
  locale: 'uk' | 'en';
  dict: any;
  currentUserId?: string;
  isAuthenticated: boolean;
  onReply: (id: string, username: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  replyingToId?: string;
  onCreateReply: (content: string, parentReplyId?: string) => void;
  isCreating: boolean;
  onCancelReply: () => void;
}

function ReplyItem({
  reply,
  children,
  locale,
  dict,
  currentUserId,
  isAuthenticated,
  onReply,
  onDelete,
  isDeleting,
  replyingToId,
  onCreateReply,
  isCreating,
  onCancelReply,
}: ReplyItemProps) {
  const timeAgo = formatDistanceToNow(new Date(reply.createdAt), {
    addSuffix: true,
    locale: DATE_LOCALES[locale],
  });

  const isOwn = currentUserId === reply.author.id;
  const isReplying = replyingToId === reply.id;

  return (
    <div className="space-y-2">
      <div className="bg-zinc-900/30 rounded-lg p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              {reply.author.avatarUrl && (
                <AvatarImage src={reply.author.avatarUrl} alt={reply.author.username} />
              )}
              <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
                {reply.author.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-zinc-300">{reply.author.username}</span>
            <span className="text-xs text-zinc-600">{timeAgo}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isAuthenticated && !isOwn && (
              <button
                onClick={() => onReply(reply.id, reply.author.username)}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Reply className="w-3 h-3" />
                {dict.reviews.replies.reply}
              </button>
            )}
            {isOwn && (
              <button
                onClick={() => onDelete(reply.id)}
                disabled={isDeleting}
                className={cn(
                  'flex items-center gap-1 text-xs text-zinc-600 hover:text-red-400 transition-colors',
                  isDeleting && 'opacity-50 cursor-not-allowed',
                )}
              >
                <Trash2 className="w-3 h-3" />
                {dict.reviews.replies.delete}
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <p className="text-sm text-zinc-300 leading-relaxed">{reply.content}</p>
      </div>

      {/* Reply form for this reply */}
      {isReplying && (
        <div className="ml-4">
          <ReviewReplyForm
            onSubmit={onCreateReply}
            onCancel={onCancelReply}
            isSubmitting={isCreating}
            parentReplyId={reply.id}
            replyToUsername={reply.author.username}
            autoFocus
          />
        </div>
      )}

      {/* Nested replies */}
      {children && children.length > 0 && (
        <div className="ml-4 pl-3 border-l border-zinc-800/50 space-y-2">
          {children.map((child) => (
            <div key={child.id} className="bg-zinc-900/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    {child.author.avatarUrl && (
                      <AvatarImage src={child.author.avatarUrl} alt={child.author.username} />
                    )}
                    <AvatarFallback className="bg-zinc-800 text-zinc-400 text-[10px]">
                      {child.author.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-zinc-300">{child.author.username}</span>
                  <span className="text-xs text-zinc-600">
                    {formatDistanceToNow(new Date(child.createdAt), {
                      addSuffix: true,
                      locale: DATE_LOCALES[locale],
                    })}
                  </span>
                </div>
                {currentUserId === child.author.id && (
                  <button
                    onClick={() => onDelete(child.id)}
                    disabled={isDeleting}
                    className={cn(
                      'flex items-center gap-1 text-xs text-zinc-600 hover:text-red-400 transition-colors',
                      isDeleting && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{child.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
