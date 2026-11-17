'use client';

import { useId, type RefObject } from 'react';
import {
  Button,
  Description,
  FieldError,
  Label,
  Switch,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  type Key,
} from '@heroui/react';
import { RATING_PRESETS, findPreset, presetForRating } from '@/entities/library';
import { interpolate, useTranslation, type Dictionary } from '@/shared/i18n';
import { formatScore, scoreFromRating } from '@/shared/lib';
import {
  MAX_REVIEW_TEXT_LENGTH,
  isAtReviewTextLimit,
  isNearReviewTextLimit,
} from '../model/review-limits';
import type { ReviewDraftState } from '../model/use-review-draft';
import type { ReviewFormState } from './use-review-form';
import { useReviewsActions } from './reviews-context';

type PresetLook = 'tiles' | 'pills';

const PRESET_GROUP_CLASSES: Record<PresetLook, string> = {
  tiles: 'grid grid-cols-4 gap-2',
  pills: 'flex flex-wrap gap-1.5',
};

const PRESET_CLASSES: Record<PresetLook, string> = {
  tiles:
    'h-17 w-full min-w-0 flex-col gap-0.5 rounded-2xl border-2 border-transparent bg-default px-1',
  pills: 'min-h-tap gap-1.5 rounded-full border-2 border-transparent bg-default px-3',
};

interface RatingPresetsProps {
  rating: number | null;
  look: PresetLook;
  errorId?: string;
  firstPresetRef: RefObject<HTMLButtonElement | null>;
  onPick: (rating: number) => void;
}

function RatingPresets({ rating, look, errorId, firstPresetRef, onPick }: RatingPresetsProps) {
  const { dict, locale } = useTranslation();
  const picked = rating === null ? undefined : presetForRating(rating);
  const isTiles = look === 'tiles';

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
      fullWidth={isTiles}
      selectedKeys={picked ? [picked.id] : []}
      onSelectionChange={pick}
      className={PRESET_GROUP_CLASSES[look]}
    >
      {RATING_PRESETS.map((preset, index) => {
        const name = dict.details.rate.presets[preset.id];
        const score = formatScore(locale, scoreFromRating(preset.score));
        return (
          <ToggleButton
            key={preset.id}
            id={preset.id}
            ref={index === 0 ? firstPresetRef : undefined}
            aria-label={`${name} ${score}`}
            className={`${PRESET_CLASSES[look]} data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft data-[selected=true]:text-foreground`}
          >
            <span aria-hidden className={isTiles ? 'text-2xl leading-none' : undefined}>
              {preset.emoji}
            </span>
            <span className="max-w-full truncate text-xs font-bold tabular-nums">
              {isTiles ? `${name} ${score}` : score}
            </span>
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
}

interface RatingBlockProps {
  draft: ReviewDraftState;
  form: ReviewFormState;
  firstPresetRef: RefObject<HTMLButtonElement | null>;
  look: PresetLook;
  className?: string;
}

export function RatingBlock({
  draft,
  form,
  firstPresetRef,
  look,
  className = '',
}: RatingBlockProps) {
  const { dict } = useTranslation();
  const { media } = useReviewsActions();
  const errorId = useId();
  const copy = dict.reviews.compose;
  const isMissing = form.shownGaps.isRatingMissing;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <span className="text-base font-bold">{copy.ratingTitle}</span>
      <RatingPresets
        rating={draft.rating}
        look={look}
        errorId={isMissing ? errorId : undefined}
        firstPresetRef={firstPresetRef}
        onPick={form.changeRating}
      />
      <p className="text-[13px] text-muted">{copy.ratingNote[media.type]}</p>
      {isMissing ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {copy.errors.rating}
        </p>
      ) : null}
    </div>
  );
}

function limitAnnouncement(copy: Dictionary['reviews']['compose'], length: number): string {
  const values = { max: MAX_REVIEW_TEXT_LENGTH };
  if (isAtReviewTextLimit(length)) return interpolate(copy.limitReached, values);
  if (isNearReviewTextLimit(length)) return interpolate(copy.limitNear, values);
  return '';
}

function LengthCounter({ length }: { length: number }) {
  const { dict } = useTranslation();
  const copy = dict.reviews.compose;

  return (
    <>
      {isNearReviewTextLimit(length) ? (
        <Description className="self-end text-xs text-muted tabular-nums">
          {interpolate(copy.counter, { count: length, max: MAX_REVIEW_TEXT_LENGTH })}
        </Description>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {limitAnnouncement(copy, length)}
      </span>
    </>
  );
}

interface ReviewTextFieldProps {
  draft: ReviewDraftState;
  form: ReviewFormState;
  textRef: RefObject<HTMLTextAreaElement | null>;
  autoFocus: boolean;
  className?: string;
  textAreaClassName: string;
}

export function ReviewTextField({
  draft,
  form,
  textRef,
  autoFocus,
  className = '',
  textAreaClassName,
}: ReviewTextFieldProps) {
  const { dict } = useTranslation();
  const copy = dict.reviews.compose;

  return (
    <TextField
      name="review"
      value={draft.content}
      onChange={form.changeContent}
      maxLength={MAX_REVIEW_TEXT_LENGTH}
      isInvalid={form.shownGaps.isTextMissing}
      fullWidth
      className={`gap-2 ${className}`}
    >
      <Label className="sr-only">{copy.textLabel}</Label>
      <TextArea
        ref={textRef}
        variant="secondary"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={copy.placeholder}
        className={`w-full rounded-[20px] px-4.5 py-4 text-base leading-normal wrap-anywhere sm:text-base ${textAreaClassName}`}
      />
      <LengthCounter length={draft.content.length} />
      <FieldError>
        <span role="alert">{copy.errors.empty}</span>
      </FieldError>
    </TextField>
  );
}

export function PublishFailure({ form }: { form: ReviewFormState }) {
  const { dict } = useTranslation();
  if (form.publishFailure === null) return null;

  return (
    <p role="alert" className="text-sm text-danger">
      {dict.reviews.compose.errors[form.publishFailure]}
    </p>
  );
}

type SwitchControlSide = 'start' | 'end';

interface SpoilerSwitchProps {
  draft: ReviewDraftState;
  form: ReviewFormState;
  controlSide: SwitchControlSide;
}

export function SpoilerSwitch({ draft, form, controlSide }: SpoilerSwitchProps) {
  const { dict } = useTranslation();
  const copy = dict.reviews.compose;
  const sideClass = controlSide === 'end' ? 'w-full flex-row-reverse' : 'flex-row';

  return (
    <Switch
      aria-label={copy.spoiler}
      isSelected={draft.hasSpoiler}
      onChange={form.changeSpoiler}
      className={`min-h-tap items-center gap-3 ${sideClass}`}
    >
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Content className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-start">
        <Label className="text-base font-semibold">{copy.spoiler}</Label>
        <Description className="text-[13px] leading-snug">{copy.spoilerHint}</Description>
      </Switch.Content>
    </Switch>
  );
}

function submitLabel(
  copy: Dictionary['reviews']['compose'],
  isPublishing: boolean,
  isEditing: boolean,
) {
  if (isPublishing) return copy.publishing;
  return isEditing ? copy.save : copy.publish;
}

interface SubmitButtonProps {
  form: ReviewFormState;
  isEditing: boolean;
  fullWidth: boolean;
}

export function SubmitButton({ form, isEditing, fullWidth }: SubmitButtonProps) {
  const { dict } = useTranslation();

  return (
    <Button
      type="submit"
      size="lg"
      isPending={form.isPublishing}
      fullWidth={fullWidth}
      className="min-h-tap rounded-full font-bold"
    >
      {submitLabel(dict.reviews.compose, form.isPublishing, isEditing)}
    </Button>
  );
}

export function CancelButton({ onCancel }: { onCancel: () => void }) {
  const { dict } = useTranslation();

  return (
    <Button variant="ghost" onPress={onCancel} className="min-h-tap min-w-tap">
      {dict.reviews.compose.cancel}
    </Button>
  );
}
