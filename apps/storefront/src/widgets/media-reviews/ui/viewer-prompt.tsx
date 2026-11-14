'use client';

import { Button } from '@heroui/react';
import { MessageSquareText, Pencil } from 'lucide-react';
import { presetForRating } from '@/entities/library';
import { useSignedInAction } from '@/shared/auth';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore, scoreFromRating } from '@/shared/lib';
import { useReviewsActions } from './reviews-context';

function useComposeSignedIn(): () => void {
  const { media, compose } = useReviewsActions();
  const runSignedIn = useSignedInAction();
  return () =>
    runSignedIn(() => compose(), {
      kind: 'review',
      title: media.title,
      mediaItemId: media.mediaItemId,
    });
}

export function EmptyReviews() {
  const { dict } = useTranslation();
  const startReview = useComposeSignedIn();

  return (
    <div className="flex flex-col items-center gap-2.5 rounded-3xl border border-dashed border-separator px-4 py-5 text-center">
      <MessageSquareText aria-hidden className="size-8 text-muted" />
      <p className="text-base font-bold">{dict.reviews.empty.title}</p>
      <p className="text-sm text-muted">{dict.reviews.empty.text}</p>
      <Button onPress={startReview} className="mt-1 min-h-tap rounded-full px-5 font-bold">
        {dict.reviews.empty.action}
      </Button>
    </div>
  );
}

export function GuestPrompt({ isViewerKnown = true }: { isViewerKnown?: boolean }) {
  const { dict } = useTranslation();
  const startReview = useComposeSignedIn();
  const text = isViewerKnown ? dict.reviews.guest.text : dict.reviews.prompt.text;
  const action = isViewerKnown ? dict.reviews.guest.action : dict.reviews.guest.write;

  return (
    <div className="flex items-center gap-3 rounded-3xl bg-surface p-3.5">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold">{dict.reviews.guest.title}</span>
        <span className="text-[13px] text-muted">{text}</span>
      </span>
      <Button onPress={startReview} className="min-h-tap shrink-0 rounded-full px-4 font-bold">
        {action}
      </Button>
    </div>
  );
}

export function WritePrompt() {
  const { dict, locale } = useTranslation();
  const { ownRating, compose } = useReviewsActions();
  const preset = ownRating === null ? undefined : presetForRating(ownRating);
  const heading =
    ownRating === null
      ? dict.reviews.prompt.unrated
      : interpolate(dict.reviews.prompt.rated, {
          emoji: preset?.emoji ?? '',
          score: formatScore(locale, scoreFromRating(ownRating)),
        });

  return (
    <Button
      variant="ghost"
      fullWidth
      onPress={() => compose()}
      className="h-auto min-h-17 justify-start gap-3 rounded-3xl bg-surface p-3.5 text-start"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold text-foreground">{heading}</span>
        <span className="text-sm font-normal whitespace-normal text-muted">
          {dict.reviews.prompt.text}
        </span>
      </span>
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
      >
        <Pencil className="size-4.5" />
      </span>
    </Button>
  );
}
