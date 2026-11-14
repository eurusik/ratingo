'use client';

import type { Review } from '@/shared/api';
import { useReplyTarget } from '../model/use-reply-target';
import { ReplyComposer } from './reply-composer';
import { ReplyList } from './reply-list';

export function InlineThread({ review }: { review: Review }) {
  const reply = useReplyTarget();

  return (
    <div className="mt-1 flex flex-col gap-3 border-s-2 border-separator ps-3.5 pt-3">
      <ReplyList review={review} onTarget={reply.pick} />
      <ReplyComposer
        review={review}
        target={reply.target}
        onSent={reply.reset}
        inputRef={reply.inputRef}
      />
    </div>
  );
}
