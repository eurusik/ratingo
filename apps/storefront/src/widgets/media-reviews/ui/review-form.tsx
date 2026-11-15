'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import {
  Button,
  Description,
  FieldError,
  Form,
  Label,
  Switch,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  type Key,
} from '@heroui/react';
import { RATING_PRESETS, findPreset, presetForRating } from '@/entities/library';
import type { Review } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore, scoreFromRating } from '@/shared/lib';
import { MAX_REVIEW_TEXT_LENGTH } from '../model/review-limits';
import type { ReviewDraftState } from '../model/use-review-draft';
import { usePublishReview } from '../model/use-publish-review';
import { useReviewsActions } from './reviews-context';

type FormLayout = 'sheet' | 'inline';

const PRESET_CLASSES: Record<FormLayout, string> = {
  sheet:
    'h-17 w-full min-w-0 flex-col gap-0.5 rounded-2xl border-2 border-transparent bg-default px-1',
  inline: 'min-h-tap gap-1.5 rounded-full border-2 border-transparent bg-default px-3',
};

interface ReviewFormProps {
  draft: ReviewDraftState;
  editing: Review | null;
  layout: FormLayout;
  onPublished: () => void;
  onCancel?: () => void;
}

interface RatingPresetsProps {
  rating: number | null;
  layout: FormLayout;
  errorId?: string;
  onPick: (rating: number) => void;
}

function RatingPresets({ rating, layout, errorId, onPick }: RatingPresetsProps) {
  const { dict, locale } = useTranslation();
  const picked = rating === null ? undefined : presetForRating(rating);

  const pick = (keys: Set<Key>) => {
    const [id] = [...keys];
    const preset = typeof id === 'string' ? findPreset(id) : undefined;
    if (preset) onPick(preset.score);
  };

  return (
    <ToggleButtonGroup
      aria-label={dict.reviews.compose.ratingLabel}
      aria-describedby={errorId}
      selectionMode="single"
      isDetached
      fullWidth={layout === 'sheet'}
      selectedKeys={picked ? [picked.id] : []}
      onSelectionChange={pick}
      className={layout === 'sheet' ? 'grid grid-cols-4 gap-2' : 'flex flex-wrap gap-1.5'}
    >
      {RATING_PRESETS.map((preset) => (
        <ToggleButton
          key={preset.id}
          id={preset.id}
          aria-label={`${dict.details.rate.presets[preset.id]} ${formatScore(locale, scoreFromRating(preset.score))}`}
          className={`${PRESET_CLASSES[layout]} data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft data-[selected=true]:text-foreground`}
        >
          <span aria-hidden className={layout === 'sheet' ? 'text-2xl leading-none' : undefined}>
            {preset.emoji}
          </span>
          <span className="max-w-full truncate text-xs font-bold tabular-nums">
            {layout === 'sheet' ? `${dict.details.rate.presets[preset.id]} ` : null}
            {formatScore(locale, scoreFromRating(preset.score))}
          </span>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

interface DraftErrors {
  isRatingMissing: boolean;
  isTextMissing: boolean;
}

const NO_ERRORS: DraftErrors = { isRatingMissing: false, isTextMissing: false };

function errorsOf(draft: ReviewDraftState): DraftErrors {
  return { isRatingMissing: draft.rating === null, isTextMissing: !draft.content.trim() };
}

function SpoilerSwitch({
  draft,
  onChange,
}: {
  draft: ReviewDraftState;
  onChange: (on: boolean) => void;
}) {
  const { dict } = useTranslation();
  const copy = dict.reviews.compose;

  return (
    <Switch isSelected={draft.hasSpoiler} onChange={onChange}>
      <Switch.Content className="flex-1">
        <Label className="text-[15px] font-semibold">{copy.spoiler}</Label>
        <Description className="text-[13px]">{copy.spoilerHint}</Description>
      </Switch.Content>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  );
}

export function ReviewForm({ draft, editing, layout, onPublished, onCancel }: ReviewFormProps) {
  const { dict } = useTranslation();
  const { media } = useReviewsActions();
  const publish = usePublishReview(media);
  const [errors, setErrors] = useState<DraftErrors>(NO_ERRORS);
  const ratingErrorId = useId();
  const presetsRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const copy = dict.reviews.compose;

  const clearPublishErrorThen =
    <T,>(change: (value: T) => void) =>
    (value: T) => {
      publish.reset();
      change(value);
    };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (publish.isPending) return;
    const found = errorsOf(draft);
    setErrors(found);
    if (found.isRatingMissing) presetsRef.current?.querySelector('button')?.focus();
    else if (found.isTextMissing) textRef.current?.focus();
    const ready = draft.toDraft();
    if (ready) publish.mutate({ draft: ready, editing }, { onSuccess: onPublished });
  };

  return (
    <Form onSubmit={submit} validationBehavior="aria" className="flex flex-col gap-3.5">
      <div ref={presetsRef} className="flex flex-col gap-1.5">
        {layout === 'inline' ? (
          <span className="text-[15px] font-bold">{copy.ratingTitle}</span>
        ) : null}
        <RatingPresets
          rating={draft.rating}
          layout={layout}
          errorId={errors.isRatingMissing ? ratingErrorId : undefined}
          onPick={clearPublishErrorThen((rating: number) => {
            setErrors((current) => ({ ...current, isRatingMissing: false }));
            draft.setRating(rating);
          })}
        />
        <p className="text-[13px] text-muted">{copy.ratingNote[media.type]}</p>
        {errors.isRatingMissing ? (
          <p id={ratingErrorId} role="alert" className="text-sm text-danger">
            {copy.errors.rating}
          </p>
        ) : null}
      </div>
      <TextField
        name="review"
        value={draft.content}
        onChange={clearPublishErrorThen((content: string) => {
          setErrors((current) => ({ ...current, isTextMissing: false }));
          draft.setContent(content);
        })}
        maxLength={MAX_REVIEW_TEXT_LENGTH}
        isInvalid={errors.isTextMissing}
        fullWidth
      >
        <Label className="sr-only">{copy.textLabel}</Label>
        <TextArea
          ref={textRef}
          variant="secondary"
          autoComplete="off"
          autoFocus={editing !== null && layout === 'inline'}
          placeholder={copy.placeholder}
          className={`w-full resize-none text-base leading-normal ${layout === 'sheet' ? 'h-33' : 'h-24 resize-y'}`}
        />
        <Description className="self-end text-xs tabular-nums">
          {interpolate(copy.counter, { count: draft.content.length, max: MAX_REVIEW_TEXT_LENGTH })}
        </Description>
        <FieldError>{copy.errors.empty}</FieldError>
      </TextField>
      <SpoilerSwitch draft={draft} onChange={clearPublishErrorThen(draft.setHasSpoiler)} />
      {publish.error ? (
        <p role="alert" className="text-sm text-danger">
          {copy.errors[publish.error.failure]}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" onPress={onCancel} className="min-h-tap">
            {copy.cancel}
          </Button>
        ) : null}
        <Button
          type="submit"
          size="lg"
          isPending={publish.isPending}
          fullWidth={layout === 'sheet'}
          className="min-h-tap rounded-full font-bold"
        >
          {publish.isPending ? copy.publishing : editing ? copy.save : copy.publish}
        </Button>
      </div>
    </Form>
  );
}
