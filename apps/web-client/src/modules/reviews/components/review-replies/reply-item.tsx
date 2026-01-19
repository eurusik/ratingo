'use client';

import { useRef, useState, useEffect } from 'react';
import type { ReplyResponseDto } from '@/core/api/reviews.client';
import { ReviewReplyForm } from '../review-reply-form';
import { ReplyCard } from './reply-card';
import { ThreadConnector } from './thread-connector';

interface ReplyingToState {
  replyId: string;
  parentId: string;
  username: string;
}

interface ReplyItemProps {
  reply: ReplyResponseDto;
  children?: ReplyResponseDto[];
  locale: 'uk' | 'en';
  currentUserId?: string;
  isAuthenticated: boolean;
  isLast?: boolean;
  /** Reply label from translations */
  replyLabel: string;
  /** Current reply being responded to */
  replyingTo: ReplyingToState | null;
  /** Callbacks */
  onReply: (replyId: string, parentId: string, username: string) => void;
  onDelete: (id: string) => void;
  onCreateReply: (content: string, parentReplyId?: string, replyToUsername?: string) => void;
  onCancelReply: () => void;
  isDeleting: boolean;
  isCreating: boolean;
}

/**
 * Renders a top-level reply with its nested children.
 * Handles thread connectors and reply form placement.
 */
export function ReplyItem({
  reply,
  children,
  locale,
  currentUserId,
  isAuthenticated,
  isLast = false,
  replyLabel,
  replyingTo,
  onReply,
  onDelete,
  onCreateReply,
  onCancelReply,
  isDeleting,
  isCreating,
}: ReplyItemProps) {
  const isOwn = currentUserId === reply.author.id;
  const isReplyingToThis = replyingTo?.replyId === reply.id;

  return (
    <div className="relative pb-4">
      <ThreadConnector showVerticalLine={!isLast} />

      <ReplyCard
        id={reply.id}
        author={reply.author}
        content={reply.content}
        replyToUsername={reply.replyToUsername}
        createdAt={reply.createdAt}
        locale={locale}
        isOwn={isOwn}
        isAuthenticated={isAuthenticated}
        isHighlighted={isReplyingToThis}
        replyLabel={replyLabel}
        onReply={
          !isOwn && !isReplyingToThis
            ? () => onReply(reply.id, reply.id, reply.author.username)
            : undefined
        }
        onDelete={() => onDelete(reply.id)}
        isDeleting={isDeleting}
      />

      {/* Reply form for this reply */}
      {isReplyingToThis && (
        <div className="mt-2 ml-6 pl-5">
          <div className="relative">
            {children && children.length > 0 && (
              <div className="absolute -left-5 top-0 -bottom-2 w-px bg-cinema-borderSoft/40" />
            )}
            <ThreadConnector variant="small" />
            <ReviewReplyForm
              onSubmit={onCreateReply}
              onCancel={onCancelReply}
              isSubmitting={isCreating}
              parentReplyId={replyingTo.parentId}
              replyToUsername={replyingTo.username}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Nested replies */}
      {children && children.length > 0 && (
        <div className="mt-2 ml-6 pl-5">
          {children.map((child, childIndex) => (
            <NestedReplyItem
              key={child.id}
              reply={child}
              parentReplyId={reply.id}
              locale={locale}
              currentUserId={currentUserId}
              isAuthenticated={isAuthenticated}
              isLast={childIndex === children.length - 1}
              replyLabel={replyLabel}
              replyingTo={replyingTo}
              onReply={onReply}
              onDelete={onDelete}
              onCreateReply={onCreateReply}
              onCancelReply={onCancelReply}
              isDeleting={isDeleting}
              isCreating={isCreating}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface NestedReplyItemProps {
  reply: ReplyResponseDto;
  parentReplyId: string;
  locale: 'uk' | 'en';
  currentUserId?: string;
  isAuthenticated: boolean;
  isLast?: boolean;
  replyLabel: string;
  replyingTo: ReplyingToState | null;
  onReply: (replyId: string, parentId: string, username: string) => void;
  onDelete: (id: string) => void;
  onCreateReply: (content: string, parentReplyId?: string, replyToUsername?: string) => void;
  onCancelReply: () => void;
  isDeleting: boolean;
  isCreating: boolean;
}

/**
 * Renders a nested reply (child of top-level reply).
 */
function NestedReplyItem({
  reply,
  parentReplyId,
  locale,
  currentUserId,
  isAuthenticated,
  isLast = false,
  replyLabel,
  replyingTo,
  onReply,
  onDelete,
  onCreateReply,
  onCancelReply,
  isDeleting,
  isCreating,
}: NestedReplyItemProps) {
  const isOwn = currentUserId === reply.author.id;
  const isReplyingToThis = replyingTo?.replyId === reply.id;
  const hasSiblingsBelow = !isLast;

  // Ref for measuring card height to calculate connector line
  const cardRef = useRef<HTMLDivElement>(null);
  const [connectorHeight, setConnectorHeight] = useState(0);

  // Calculate connector height when replying to last item
  useEffect(() => {
    if (!isReplyingToThis || hasSiblingsBelow || !cardRef.current) {
      setConnectorHeight(0);
      return;
    }

    const calculateHeight = () => {
      if (cardRef.current) {
        // Connector goes from card hook to form hook
        // Height = card height + mt-3 gap (12px)
        const cardHeight = cardRef.current.offsetHeight;
        setConnectorHeight(cardHeight + 12);
      }
    };

    // Initial calculation
    calculateHeight();

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(calculateHeight);
    resizeObserver.observe(cardRef.current);

    return () => resizeObserver.disconnect();
  }, [isReplyingToThis, hasSiblingsBelow]);

  return (
    <div className="relative pb-3">
      {/* Vertical line - full length when siblings exist */}
      {hasSiblingsBelow && (
        <div className="absolute -left-5 top-0 bottom-0 w-px bg-cinema-borderSoft/40" />
      )}
      {/* Connector line for last item when replying - dynamically calculated */}
      {!hasSiblingsBelow && isReplyingToThis && connectorHeight > 0 && (
        <div
          className="absolute -left-5 top-0 w-px bg-cinema-borderSoft/40"
          style={{ height: connectorHeight }}
        />
      )}

      {/* Curved hook */}
      <div className="absolute -left-5 top-0 w-4 h-4">
        <div className="w-full h-full border-l border-b border-cinema-borderSoft/40 rounded-bl-lg" />
      </div>

      <div ref={cardRef}>
        <ReplyCard
          id={reply.id}
          author={reply.author}
          content={reply.content}
          replyToUsername={reply.replyToUsername}
          createdAt={reply.createdAt}
          locale={locale}
          isOwn={isOwn}
          isAuthenticated={isAuthenticated}
          isHighlighted={isReplyingToThis}
          variant="nested"
          replyLabel={replyLabel}
          onReply={
            !isOwn && !isReplyingToThis
              ? () => onReply(reply.id, parentReplyId, reply.author.username)
              : undefined
          }
          onDelete={() => onDelete(reply.id)}
          isDeleting={isDeleting}
        />
      </div>

      {/* Reply form for this nested reply */}
      {isReplyingToThis && (
        <div className="relative mt-3">
          {/* Curved hook for form */}
          <div className="absolute -left-5 top-0 w-4 h-4">
            <div className="w-full h-full border-l border-b border-cinema-borderSoft/40 rounded-bl-lg" />
          </div>
          <ReviewReplyForm
            onSubmit={onCreateReply}
            onCancel={onCancelReply}
            isSubmitting={isCreating}
            parentReplyId={replyingTo.parentId}
            replyToUsername={replyingTo.username}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
