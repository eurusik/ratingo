'use client';

import type { Review } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { Sheet } from '@/shared/ui';
import { useLastShown } from '../model/use-last-shown';
import { useReplyTarget } from '../model/use-reply-target';
import { ReplyComposer } from './reply-composer';
import { ReplyList } from './reply-list';

interface ThreadSheetProps {
  review: Review | null;
  onClose: () => void;
}

export function ThreadSheet({ review, onClose }: ThreadSheetProps) {
  const { dict } = useTranslation();
  const shown = useLastShown(review);
  const reply = useReplyTarget();

  const close = () => {
    reply.reset();
    onClose();
  };

  return (
    <Sheet
      isOpen={review !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) close();
      }}
      title={interpolate(dict.reviews.replies.title, { count: shown?.repliesCount ?? 0 })}
      size="full"
      footer={
        shown ? (
          <div className="w-full">
            <ReplyComposer
              key={shown.id}
              review={shown}
              target={reply.target}
              onSent={reply.reset}
              onCancelTarget={reply.reset}
              inputRef={reply.inputRef}
            />
          </div>
        ) : null
      }
    >
      {shown ? (
        <div className="flex flex-col gap-4">
          <p className="line-clamp-2 text-sm break-words text-muted">
            <b className="font-semibold text-foreground/85">{shown.author.username}:</b>{' '}
            {shown.hasSpoiler ? dict.reviews.card.spoilerHidden : shown.content}
          </p>
          <ReplyList key={shown.id} review={shown} onTarget={reply.pick} />
        </div>
      ) : null}
    </Sheet>
  );
}
