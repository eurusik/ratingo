'use client';

import type { Review } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useGuardedClose } from '../lib/use-guarded-close';
import { useReviewDraft } from '../model/use-review-draft';
import { DiscardDraftDialog } from './discard-draft-dialog';
import { InlineReviewForm } from './inline-review-form';
import { useReviewsActions } from './reviews-context';

interface InlineComposeProps {
  editing: Review | null;
  onDone: () => void;
}

export function InlineCompose({ editing, onDone }: InlineComposeProps) {
  const { dict } = useTranslation();
  const { ownRating } = useReviewsActions();
  const draft = useReviewDraft(editing, ownRating);
  const closing = useGuardedClose(draft.hasContentChanges, editing ? onDone : draft.resetContent);
  const title = editing ? dict.reviews.compose.editTitle : dict.reviews.compose.title;

  return (
    <section aria-label={title} className="rounded-[28px] border border-separator bg-surface p-7">
      <InlineReviewForm
        draft={draft}
        editing={editing}
        onPublished={onDone}
        onCancel={closing.request}
      />
      <DiscardDraftDialog
        isOpen={closing.isAsking}
        onKeep={closing.keep}
        onDiscard={closing.discard}
      />
    </section>
  );
}
