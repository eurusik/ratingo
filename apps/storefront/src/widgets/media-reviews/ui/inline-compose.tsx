'use client';

import type { Review } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useReviewComposer } from '../model/use-review-composer';
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
  const { draft, closing } = useReviewComposer(
    editing,
    ownRating,
    editing ? onDone : (draft) => draft.resetContent(),
  );
  const title = editing ? dict.reviews.compose.editTitle : dict.reviews.compose.title;

  return (
    <section aria-label={title} className="rounded-[28px] border border-separator bg-surface p-7">
      <ReviewForm
        draft={draft}
        editing={editing}
        layout="inline"
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
