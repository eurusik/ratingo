'use client';

import { useRef } from 'react';
import { Form } from '@heroui/react';
import type { Review } from '@/shared/api';
import type { ReviewDraftState } from '../model/use-review-draft';
import {
  CancelButton,
  PublishFailure,
  RatingBlock,
  ReviewTextField,
  SpoilerSwitch,
  SubmitButton,
} from './review-form-fields';
import { useReviewForm } from './use-review-form';

const HIDDEN_WHILE_TYPING_ON_TOUCH = 'pointer-coarse:group-has-[textarea:focus]/compose:hidden';

interface ReviewFormProps {
  draft: ReviewDraftState;
  editing: Review | null;
  onPublished: () => void;
  onCancel: () => void;
}

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
  const hidesRatingWhileTyping = draft.rating !== null;

  return (
    <Form
      onSubmit={form.submit}
      validationBehavior="aria"
      className="group/compose flex h-full flex-col gap-4.5 pb-[max(0.5rem,var(--safe-bottom))]"
    >
      <SheetHeader title={title} onCancel={onCancel} />
      <RatingBlock
        draft={draft}
        form={form}
        firstPresetRef={firstPresetRef}
        look="tiles"
        className={hidesRatingWhileTyping ? HIDDEN_WHILE_TYPING_ON_TOUCH : ''}
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

export function InlineReviewForm({ draft, editing, onPublished, onCancel }: ReviewFormProps) {
  const isEditing = editing !== null;
  const firstPresetRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const form = useReviewForm({
    firstPresetRef,
    textRef,
    draft,
    editing,
    focusesTextOnOpen: isEditing,
    onPublished,
  });

  return (
    <Form onSubmit={form.submit} validationBehavior="aria" className="flex flex-col gap-5.5">
      <RatingBlock draft={draft} form={form} firstPresetRef={firstPresetRef} look="pills" />
      <ReviewTextField
        draft={draft}
        form={form}
        textRef={textRef}
        autoFocus={isEditing}
        textAreaClassName="min-h-45 max-h-100 resize-y [field-sizing:content]"
      />
      <PublishFailure form={form} />
      <div className="flex flex-wrap items-center gap-2">
        <SpoilerSwitch draft={draft} form={form} controlSide="start" />
        <div className="ms-auto flex items-center gap-2">
          <CancelButton onCancel={onCancel} />
          <SubmitButton form={form} isEditing={isEditing} fullWidth={false} />
        </div>
      </div>
    </Form>
  );
}
