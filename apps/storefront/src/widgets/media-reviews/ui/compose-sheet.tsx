'use client';

import type { Review } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { Sheet } from '@/shared/ui';
import { useGuardedClose } from '../model/use-guarded-close';
import { useReviewDraft } from '../model/use-review-draft';
import { DiscardDraftDialog } from './discard-draft-dialog';
import { ReviewForm } from './review-form';
import { useReviewsActions } from './reviews-context';

interface ComposeSheetProps {
  isOpen: boolean;
  editing: Review | null;
  onClose: () => void;
}

export function ComposeSheet({ isOpen, editing, onClose }: ComposeSheetProps) {
  const { dict } = useTranslation();
  const { ownRating } = useReviewsActions();
  const draft = useReviewDraft(editing, ownRating);
  const closing = useGuardedClose(draft.isDirty, onClose);

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) closing.request();
        }}
        title={editing ? dict.reviews.compose.editTitle : dict.reviews.compose.title}
      >
        <ReviewForm draft={draft} editing={editing} layout="sheet" onPublished={onClose} />
      </Sheet>
      <DiscardDraftDialog
        isOpen={closing.isAsking}
        onKeep={closing.keep}
        onDiscard={closing.discard}
      />
    </>
  );
}
