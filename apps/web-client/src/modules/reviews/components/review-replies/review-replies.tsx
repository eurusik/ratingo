'use client';

import { useState } from 'react';
import { MessageCircle, ChevronDown, ChevronUp, Reply } from 'lucide-react';
import { toast } from 'sonner';
import { useReplies, useCreateReply, useDeleteReply } from '@/core/query/reviews';
import { useTranslation, useLocale } from '@/shared/i18n';
import { ReviewReplyForm } from '../review-reply-form';
import { ReplyItem } from './reply-item';
import { useNestedReplies } from './use-nested-replies';

interface ReviewRepliesProps {
  reviewId: string;
  mediaItemId: string;
  repliesCount: number;
  isAuthenticated?: boolean;
  currentUserId?: string;
}

/**
 * Replies section for a review.
 * Handles fetching, creating, deleting replies with nested threading.
 */
export function ReviewReplies({
  reviewId,
  mediaItemId,
  repliesCount,
  isAuthenticated = false,
  currentUserId,
}: ReviewRepliesProps) {
  const { dict } = useTranslation();
  const locale = useLocale();

  const [isExpanded, setIsExpanded] = useState(repliesCount > 0 && repliesCount <= 3);
  const [replyingTo, setReplyingTo] = useState<{
    replyId: string;
    parentId: string;
    username: string;
  } | null>(null);
  const [showReplyForm, setShowReplyForm] = useState(false);

  const { data: replies, isLoading } = useReplies(reviewId, { enabled: isExpanded });
  const createReply = useCreateReply(reviewId, mediaItemId);
  const deleteReply = useDeleteReply(reviewId, mediaItemId);

  const nestedReplies = useNestedReplies(replies);

  const handleCreateReply = async (
    content: string,
    parentReplyId?: string,
    replyToUsername?: string,
  ) => {
    try {
      await createReply.mutateAsync({ content, parentReplyId, replyToUsername });
      toast.success(dict.reviews.replies.toast.created);
      setReplyingTo(null);
      setShowReplyForm(false);
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
            className="flex items-center gap-1.5 text-sm text-cinema-text-muted hover:text-cinema-text-secondary transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>
              {isExpanded ? dict.reviews.replies.hideReplies : dict.reviews.replies.showReplies}
            </span>
            <span className="text-cinema-text-disabled">({repliesCount})</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}

        {/* Replies list with smooth animation */}
        {repliesCount > 0 && (
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out"
            style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden min-h-0">
              {isLoading ? (
                <div className="text-sm text-cinema-text-muted animate-pulse pl-6 py-2">
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
                      currentUserId={currentUserId}
                      isAuthenticated={isAuthenticated}
                      isLast={index === nestedReplies.topLevel.length - 1}
                      replyLabel={dict.reviews.replies.reply}
                      replyingTo={replyingTo}
                      onReply={(replyId, parentId, username) =>
                        setReplyingTo({ replyId, parentId, username })
                      }
                      onDelete={handleDeleteReply}
                      onCreateReply={handleCreateReply}
                      onCancelReply={() => setReplyingTo(null)}
                      isDeleting={deleteReply.isPending}
                      isCreating={createReply.isPending}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-sm text-cinema-text-muted py-2">{dict.reviews.replies.empty}</div>
              )}
            </div>
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
                className="flex items-center gap-1.5 text-sm text-cinema-text-muted hover:text-cinema-text-secondary transition-colors"
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
