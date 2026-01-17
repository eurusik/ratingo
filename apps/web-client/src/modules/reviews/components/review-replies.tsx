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

  // Show replies by default if 3 or fewer
  const [isExpanded, setIsExpanded] = useState(repliesCount > 0 && repliesCount <= 3);
  // replyId = actual reply clicked, parentId = parent for API call, username = who we're replying to
  const [replyingTo, setReplyingTo] = useState<{ replyId: string; parentId: string; username: string } | null>(null);
  const [showReplyForm, setShowReplyForm] = useState(false);

  const { data: replies, isLoading } = useReplies(reviewId, {
    enabled: isExpanded,
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
      setShowReplyForm(false);
      // Auto-expand to show the new reply
      if (!isExpanded) setIsExpanded(true);
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
    <div className="mt-4">
      <div className="space-y-3">
        {/* Toggle button */}
        {repliesCount > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
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
          <div>
            {isLoading ? (
              <div className="text-sm text-zinc-500 animate-pulse pl-6">
                {dict.reviews.replies.title}...
              </div>
            ) : replies && replies.length > 0 ? (
              <div className="relative pl-6">
                {nestedReplies.topLevel.map((reply, index) => (
                  <ReplyItem
                    key={reply.id}
                    reply={reply}
                    children={nestedReplies.childrenMap.get(reply.id)}
                    locale={locale}
                    dict={dict}
                    currentUserId={currentUserId}
                    isAuthenticated={isAuthenticated}
                    onReply={(replyId, parentId, username) => setReplyingTo({ replyId, parentId, username })}
                    onDelete={handleDeleteReply}
                    isDeleting={deleteReply.isPending}
                    replyingToId={replyingTo?.replyId}
                    replyingToParentId={replyingTo?.parentId}
                    replyingToUsername={replyingTo?.username}
                    onCreateReply={handleCreateReply}
                    isCreating={createReply.isPending}
                    onCancelReply={() => setReplyingTo(null)}
                    isLast={index === nestedReplies.topLevel.length - 1}
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
          <div>
            {showReplyForm ? (
              <ReviewReplyForm
                onSubmit={handleCreateReply}
                onCancel={() => setShowReplyForm(false)}
                isSubmitting={createReply.isPending}
                autoFocus
              />
            ) : (
              <button
                onClick={() => setShowReplyForm(true)}
                className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Reply className="w-4 h-4" />
                {dict.reviews.replies.reply}
              </button>
            )}
          </div>
        )}
      </div>
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
  onReply: (replyId: string, parentId: string, username: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  replyingToId?: string;
  replyingToParentId?: string;
  replyingToUsername?: string;
  onCreateReply: (content: string, parentReplyId?: string) => void;
  isCreating: boolean;
  onCancelReply: () => void;
  isLast?: boolean;
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
  replyingToParentId,
  replyingToUsername,
  onCreateReply,
  isCreating,
  onCancelReply,
  isLast = false,
}: ReplyItemProps) {
  const timeAgo = formatDistanceToNow(new Date(reply.createdAt), {
    addSuffix: true,
    locale: DATE_LOCALES[locale],
  });

  const isOwn = currentUserId === reply.author.id;

  return (
    <div className="relative pb-3">
      {/* Vertical line segment - only if not last (to connect to next sibling) */}
      {!isLast && (
        <div className="absolute -left-5 top-0 bottom-0 w-0.5 bg-zinc-700" />
      )}

      {/* Curved hook ╰ pointing to avatar */}
      <div className="absolute -left-5 top-0 w-4 h-5">
        <div className="w-full h-full border-l-2 border-b-2 border-zinc-700 rounded-bl-lg" />
      </div>

      {/* Reply card */}
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

          {/* Delete button for own replies */}
          {isOwn && (
            <button
              onClick={() => onDelete(reply.id)}
              disabled={isDeleting}
              className={cn(
                'text-zinc-600 hover:text-red-400 transition-colors',
                isDeleting && 'opacity-50 cursor-not-allowed',
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Content */}
        <p className="text-sm text-zinc-300 leading-relaxed">{reply.content}</p>

        {/* Reply button - below content */}
        {isAuthenticated && !isOwn && replyingToId !== reply.id && (
          <button
            onClick={() => onReply(reply.id, reply.id, reply.author.username)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mt-2"
          >
            <Reply className="w-3 h-3" />
            {dict.reviews.replies.reply}
          </button>
        )}
      </div>

      {/* Reply form for top-level - only if replying to this reply directly */}
      {replyingToId === reply.id && (
        <div className="mt-2 ml-6 pl-5">
          <div className="relative">
            {/* Vertical line connecting to nested replies below - extends past margin */}
            {children && children.length > 0 && (
              <div className="absolute -left-5 top-0 -bottom-2 w-0.5 bg-zinc-700" />
            )}
            {/* Curved hook for form */}
            <div className="absolute -left-5 top-0 w-4 h-4">
              <div className="w-full h-full border-l-2 border-b-2 border-zinc-700 rounded-bl-lg" />
            </div>
            <ReviewReplyForm
              onSubmit={onCreateReply}
              onCancel={onCancelReply}
              isSubmitting={isCreating}
              parentReplyId={replyingToParentId}
              replyToUsername={replyingToUsername}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Nested replies - indented to show hierarchy */}
      {children && children.length > 0 && (
        <div className="mt-2 ml-6 pl-5">
          {children.map((child, childIndex) => (
            <div key={child.id} className="relative pb-2">
              {/* Vertical line for nested - only if not last (to connect to next sibling) */}
              {childIndex < children.length - 1 && (
                <div className="absolute -left-5 top-0 bottom-0 w-0.5 bg-zinc-700" />
              )}
              {/* Curved hook for nested reply */}
              <div className="absolute -left-5 top-0 w-4 h-4">
                <div className="w-full h-full border-l-2 border-b-2 border-zinc-700 rounded-bl-lg" />
              </div>
              <div className="bg-zinc-900/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      {child.author.avatarUrl && (
                        <AvatarImage src={child.author.avatarUrl} alt={child.author.username} />
                      )}
                      <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
                        {child.author.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-zinc-300">{child.author.username}</span>
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
                        'text-zinc-600 hover:text-red-400 transition-colors',
                        isDeleting && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{child.content}</p>

                {/* Reply button for nested - creates sibling reply mentioning this user */}
                {isAuthenticated && currentUserId !== child.author.id && replyingToId !== child.id && (
                  <button
                    onClick={() => onReply(child.id, reply.id, child.author.username)}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mt-1"
                  >
                    <Reply className="w-3 h-3" />
                    {dict.reviews.replies.reply}
                  </button>
                )}
              </div>

              {/* Reply form for this nested reply */}
              {replyingToId === child.id && (
                <div className="relative mt-2">
                  {/* Vertical line connecting to nested reply above - extends up through card area */}
                  <div className="absolute -left-5 -top-16 h-16 w-0.5 bg-zinc-700" />
                  {/* Curved hook for form */}
                  <div className="absolute -left-5 top-0 w-4 h-4">
                    <div className="w-full h-full border-l-2 border-b-2 border-zinc-700 rounded-bl-lg" />
                  </div>
                  <ReviewReplyForm
                    onSubmit={onCreateReply}
                    onCancel={onCancelReply}
                    isSubmitting={isCreating}
                    parentReplyId={replyingToParentId}
                    replyToUsername={replyingToUsername}
                    autoFocus
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
