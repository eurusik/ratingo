'use client';

import type { Review } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { Sheet } from '@/shared/ui';
import { useGuardedClose } from '../lib/use-guarded-close';
import { useReviewDraft } from '../model/use-review-draft';
import { DiscardDraftDialog } from './discard-draft-dialog';
import { SheetReviewForm } from './sheet-review-form';
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
  const closing = useGuardedClose(draft.hasContentChanges, onClose);
  const title = editing ? dict.reviews.compose.editTitle : dict.reviews.compose.title;

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) closing.request();
        }}
        title={title}
        size="full"
        isHeaderless
      >
        <SheetReviewForm
          draft={draft}
          editing={editing}
          title={title}
          onPublished={onClose}
          onCancel={closing.request}
        />
      </Sheet>
      <DiscardDraftDialog
        isOpen={closing.isAsking}
        onKeep={closing.keep}
        onDiscard={closing.discard}
      />
    </>
  );
}
