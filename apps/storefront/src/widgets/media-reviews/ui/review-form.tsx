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
import { MAX_REVIEW_TEXT_LENGTH, isNearReviewTextLimit } from '../model/review-limits';
import type { ReviewDraftState } from '../model/use-review-draft';
import { usePublishReview } from '../model/use-publish-review';
import { useReviewsActions } from './reviews-context';

type FormLayout = 'sheet' | 'inline';

const PRESET_CLASSES: Record<FormLayout, string> = {
  sheet:
    'h-17 w-full min-w-0 flex-col gap-0.5 rounded-2xl border-2 border-transparent bg-default px-1',
  inline: 'min-h-tap gap-1.5 rounded-full border-2 border-transparent bg-default px-3',
};

const TEXT_AREA_CLASSES: Record<FormLayout, string> = {
  sheet: 'min-h-24 flex-1 resize-none',
  inline: 'min-h-45 max-h-100 resize-y [field-sizing:content]',
};

const RATING_BLOCK_CLASSES: Record<FormLayout, string> = {
  sheet: 'group-has-[textarea:focus]/compose:hidden',
  inline: '',
};

const SPOILER_SWITCH_CLASSES: Record<FormLayout, string> = {
  sheet: 'w-full flex-row-reverse',
  inline: 'flex-row',
};

interface ReviewFormBaseProps {
  draft: ReviewDraftState;
  editing: Review | null;
  onPublished: () => void;
}

interface InlineReviewFormProps extends ReviewFormBaseProps {
  layout: 'inline';
  onCancel?: () => void;
}

interface SheetReviewFormProps extends ReviewFormBaseProps {
  layout: 'sheet';
  title: string;
  onCancel: () => void;
}

type ReviewFormProps = InlineReviewFormProps | SheetReviewFormProps;

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

interface SpoilerSwitchProps {
  isSelected: boolean;
  layout: FormLayout;
  onChange: (isSelected: boolean) => void;
}

function SpoilerSwitch({ isSelected, layout, onChange }: SpoilerSwitchProps) {
  const { dict } = useTranslation();
  const copy = dict.reviews.compose;

  return (
    <Switch
      aria-label={copy.spoiler}
      isSelected={isSelected}
      onChange={onChange}
      className={`min-h-tap items-center gap-3 ${SPOILER_SWITCH_CLASSES[layout]}`}
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

function LengthCounter({ length }: { length: number }) {
  const { dict } = useTranslation();
  if (!isNearReviewTextLimit(length)) return null;

  return (
    <Description className="self-end text-xs text-muted tabular-nums">
      {interpolate(dict.reviews.compose.counter, { count: length, max: MAX_REVIEW_TEXT_LENGTH })}
    </Description>
  );
}

interface SubmitButtonProps {
  isPending: boolean;
  isEditing: boolean;
  fullWidth: boolean;
}

function SubmitButton({ isPending, isEditing, fullWidth }: SubmitButtonProps) {
  const { dict } = useTranslation();
  const copy = dict.reviews.compose;

  return (
    <Button
      type="submit"
      size="lg"
      isPending={isPending}
      fullWidth={fullWidth}
      className="min-h-tap rounded-full font-bold"
    >
      {isPending ? copy.publishing : isEditing ? copy.save : copy.publish}
    </Button>
  );
}

function CancelButton({ onCancel }: { onCancel: () => void }) {
  const { dict } = useTranslation();

  return (
    <Button variant="ghost" onPress={onCancel} className="min-h-tap">
      {dict.reviews.compose.cancel}
    </Button>
  );
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
    </div>
  );
}

export function ReviewForm(props: ReviewFormProps) {
  const { draft, editing, layout, onPublished, onCancel } = props;
  const { dict } = useTranslation();
  const { media } = useReviewsActions();
  const publish = usePublishReview(media);
  const [errors, setErrors] = useState<DraftErrors>(NO_ERRORS);
  const ratingErrorId = useId();
  const presetsRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const copy = dict.reviews.compose;
  const isSheet = layout === 'sheet';

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

  const spoilerSwitch = (
    <SpoilerSwitch
      isSelected={draft.hasSpoiler}
      layout={layout}
      onChange={clearPublishErrorThen(draft.setHasSpoiler)}
    />
  );
  const submitButton = (
    <SubmitButton isPending={publish.isPending} isEditing={editing !== null} fullWidth={isSheet} />
  );

  return (
    <Form
      onSubmit={submit}
      validationBehavior="aria"
      className={
        isSheet
          ? 'group/compose flex h-full flex-col gap-4.5 pb-[max(0.5rem,var(--safe-bottom))]'
          : 'flex flex-col gap-5.5'
      }
    >
      {props.layout === 'sheet' ? (
        <SheetHeader title={props.title} onCancel={props.onCancel} />
      ) : null}
      <div ref={presetsRef} className={`flex flex-col gap-2 ${RATING_BLOCK_CLASSES[layout]}`}>
        <span className="text-base font-bold">{copy.ratingTitle}</span>
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
        className={`gap-2 ${isSheet ? 'flex-1' : ''}`}
      >
        <Label className="sr-only">{copy.textLabel}</Label>
        <TextArea
          ref={textRef}
          variant="secondary"
          autoComplete="off"
          autoFocus={editing !== null && !isSheet}
          placeholder={copy.placeholder}
          className={`w-full rounded-[20px] px-4.5 py-4 text-base leading-normal sm:text-base ${TEXT_AREA_CLASSES[layout]}`}
        />
        <LengthCounter length={draft.content.length} />
        <FieldError>{copy.errors.empty}</FieldError>
      </TextField>
      {publish.error ? (
        <p role="alert" className="text-sm text-danger">
          {copy.errors[publish.error.failure]}
        </p>
      ) : null}
      {isSheet ? (
        <>
          {spoilerSwitch}
          {submitButton}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {spoilerSwitch}
          <div className="ms-auto flex items-center gap-2">
            {onCancel ? <CancelButton onCancel={onCancel} /> : null}
            {submitButton}
          </div>
        </div>
      )}
    </Form>
  );
}
