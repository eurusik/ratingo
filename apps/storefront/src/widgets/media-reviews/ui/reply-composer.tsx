'use client';

import { useState, type FormEvent, type RefObject } from 'react';
import { Button, Form, Input, Label, TextField } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import { ArrowRight } from 'lucide-react';
import type { Review } from '@/shared/api';
import { openAuth } from '@/shared/auth';
import { interpolate, useTranslation } from '@/shared/i18n';
import { replyDraftFor, type ReplyTarget } from '../model/reply-thread';
import { MAX_REVIEW_TEXT_LENGTH } from '../model/review-limits';
import { useSendReply } from '../model/use-replies';
import { useReviewsActions } from './reviews-context';

interface ReplyComposerProps {
  review: Review;
  target: ReplyTarget | null;
  onSent: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function ReplyComposer({ review, target, onSent, inputRef }: ReplyComposerProps) {
  const { dict } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { media, isDesktop } = useReviewsActions();
  const [content, setContent] = useState('');
  const send = useSendReply(review.id, media.mediaItemId);

  if (!isAuthenticated) {
    return (
      <Button variant="secondary" fullWidth onPress={() => openAuth()} className="min-h-tap">
        {dict.reviews.replies.signIn}
      </Button>
    );
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = content.trim();
    if (!text || send.isPending) return;
    send.mutate(replyDraftFor(text, target), {
      onSuccess: () => {
        setContent('');
        onSent();
      },
    });
  };

  const name = target?.username ?? review.author.username;

  return (
    <Form onSubmit={submit} className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2">
        <TextField
          name="reply"
          value={content}
          onChange={setContent}
          maxLength={MAX_REVIEW_TEXT_LENGTH}
          className="min-w-0 flex-1"
        >
          <Label className="sr-only">{dict.reviews.replies.label}</Label>
          <Input
            ref={inputRef}
            variant="secondary"
            autoComplete="off"
            enterKeyHint="send"
            placeholder={interpolate(dict.reviews.replies.placeholder, { name })}
            className="min-h-tap w-full rounded-full text-base"
          />
        </TextField>
        <Button
          type="submit"
          isIconOnly={!isDesktop}
          isPending={send.isPending}
          aria-label={isDesktop ? undefined : dict.reviews.replies.send}
          className="min-h-tap min-w-11 shrink-0 rounded-full"
        >
          {isDesktop ? dict.reviews.replies.send : <ArrowRight aria-hidden className="size-5" />}
        </Button>
      </div>
      {send.isError ? (
        <p role="alert" className="text-sm text-danger">
          {dict.reviews.replies.failed}
        </p>
      ) : null}
    </Form>
  );
}
