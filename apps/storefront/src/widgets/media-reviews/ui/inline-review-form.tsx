'use client';

import { useRef } from 'react';
import { Form } from '@heroui/react';
import {
  CancelButton,
  PublishFailure,
  RatingBlock,
  ReviewTextField,
  SpoilerSwitch,
  SubmitButton,
} from './review-form-fields';
import { useReviewForm, type ReviewFormProps } from './use-review-form';

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
