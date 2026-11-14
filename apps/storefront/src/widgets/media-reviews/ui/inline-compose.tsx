'use client';

import type { Review } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useGuardedClose } from '../model/use-guarded-close';
import { useReviewDraft } from '../model/use-review-draft';
import { DiscardDraftDialog } from './discard-draft-dialog';
import { ReviewForm } from './review-form';
import { useReviewsActions } from './reviews-context';

interface InlineComposeProps {
  editing: Review | null;
  onDone: () => void;
}

export function InlineCompose({ editing, onDone }: InlineComposeProps) {
  const { dict } = useTranslation();
  const { ownRating } = useReviewsActions();
  const draft = useReviewDraft(editing, ownRating);
  const closing = useGuardedClose(draft.isDirty, onDone);
  const title = editing ? dict.reviews.compose.editTitle : dict.reviews.compose.title;

  return (
    <section aria-label={title} className="rounded-3xl border border-separator bg-surface p-4">
      <ReviewForm
        draft={draft}
        editing={editing}
        layout="inline"
        onPublished={onDone}
        onCancel={editing ? closing.request : undefined}
      />
      <DiscardDraftDialog
        isOpen={closing.isAsking}
        onKeep={closing.keep}
        onDiscard={closing.discard}
      />
    </section>
  );
}
