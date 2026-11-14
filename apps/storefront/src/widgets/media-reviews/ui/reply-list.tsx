'use client';

import { Button, Skeleton } from '@heroui/react';
import type { Review, ReviewReply } from '@/shared/api';
import { useSignedInAction } from '@/shared/auth';
import { useTranslation } from '@/shared/i18n';
import type { ReplyTarget } from '../model/reply-thread';
import { useReplyThread } from '../model/use-replies';
import { ReviewAvatar } from './review-avatar';
import { ReviewTime } from './review-time';

interface ReplyItemProps {
  reply: ReviewReply;
  isAnswer: boolean;
  onReply: () => void;
}

function ReplyItem({ reply, isAnswer, onReply }: ReplyItemProps) {
  const { dict } = useTranslation();

  return (
    <li className={`flex gap-2.5 ${isAnswer ? 'ps-10.5' : ''}`}>
      <ReviewAvatar
        username={reply.author.username}
        avatarUrl={reply.author.avatarUrl}
        size={isAnswer ? 'sm' : 'md'}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <b className="font-bold">{reply.author.username}</b>{' '}
          <span className="text-muted">
            · <ReviewTime date={reply.createdAt} />
          </span>
        </p>
        <p className="mt-0.5 text-[15px] leading-normal break-words whitespace-pre-line text-foreground/90">
          {reply.replyToUsername ? (
            <span className="text-accent">@{reply.replyToUsername} </span>
          ) : null}
          {reply.content}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onPress={onReply}
          className="-ms-2 min-h-tap px-2 text-[13px] font-semibold text-muted"
        >
          {dict.reviews.card.reply}
        </Button>
      </div>
    </li>
  );
}

function RepliesSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-4">
      {[0, 1].map((row) => (
        <div key={row} className="flex gap-2.5">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-28 rounded-full" />
            <Skeleton className="h-4 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ReplyListProps {
  review: Review;
  onTarget: (target: ReplyTarget) => void;
}

export function ReplyList({ review, onTarget }: ReplyListProps) {
  const { dict } = useTranslation();
  const { query, thread } = useReplyThread(review.id);
  const runSignedIn = useSignedInAction();
  const answer = (target: ReplyTarget) => runSignedIn(() => onTarget(target));

  if (query.isPending) return <RepliesSkeleton label={dict.common.loading} />;
  if (query.isError) {
    return (
      <div role="alert" className="flex items-center gap-3 text-sm text-muted">
        <span className="flex-1">{dict.reviews.replies.loadError}</span>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => void query.refetch()}
          className="min-h-tap"
        >
          {dict.common.retry}
        </Button>
      </div>
    );
  }
  if (thread.length === 0)
    return <p className="text-sm text-muted">{dict.reviews.replies.empty}</p>;

  return (
    <ul className="flex flex-col gap-3.5">
      {thread.flatMap(({ reply, answers }) => [
        <ReplyItem
          key={reply.id}
          reply={reply}
          isAnswer={false}
          onReply={() => answer({ branchId: reply.id, username: reply.author.username })}
        />,
        ...answers.map((item) => (
          <ReplyItem
            key={item.id}
            reply={item}
            isAnswer
            onReply={() => answer({ branchId: reply.id, username: item.author.username })}
          />
        )),
      ])}
    </ul>
  );
}
