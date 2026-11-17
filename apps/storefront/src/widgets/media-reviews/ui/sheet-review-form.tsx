'use client';

import { useRef } from 'react';
import { Form } from '@heroui/react';
import { useKeyboardHeight } from '@ratingo/ui/overlay';
import {
  CancelButton,
  PublishFailure,
  RatingBlock,
  ReviewTextField,
  SpoilerSwitch,
  SubmitButton,
} from './review-form-fields';
import { useReviewForm, type ReviewFormProps } from './use-review-form';

function SheetHeader({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="justify-self-start">
        <CancelButton onCancel={onCancel} />
      </div>
      <span aria-hidden className="truncate text-[17px] font-bold">
        {title}
      </span>
      <span aria-hidden />
    </div>
  );
}

export function SheetReviewForm({
  draft,
  editing,
  title,
  onPublished,
  onCancel,
}: ReviewFormProps & { title: string }) {
  const firstPresetRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const form = useReviewForm({
    firstPresetRef,
    textRef,
    draft,
    editing,
    focusesTextOnOpen: true,
    onPublished,
  });
  const isKeyboardOpen = useKeyboardHeight() > 0;
  const hidesRating = isKeyboardOpen && draft.rating !== null;

  return (
    <Form
      onSubmit={form.submit}
      validationBehavior="aria"
      className="flex h-full flex-col gap-4.5 pb-[max(0.5rem,var(--safe-bottom))]"
    >
      <SheetHeader title={title} onCancel={onCancel} />
      <RatingBlock
        draft={draft}
        form={form}
        firstPresetRef={firstPresetRef}
        look="tiles"
        className={hidesRating ? 'hidden' : ''}
      />
      <ReviewTextField
        draft={draft}
        form={form}
        textRef={textRef}
        autoFocus
        className="flex-1"
        textAreaClassName="min-h-24 flex-1 resize-none"
      />
      <PublishFailure form={form} />
      <SpoilerSwitch draft={draft} form={form} controlSide="end" />
      <SubmitButton form={form} isEditing={editing !== null} fullWidth />
    </Form>
  );
}
