'use client';

import { useMemo, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import { Button, Checkbox, Textarea } from '@/shared/ui';
import {
  createReviewSchema,
  type ReviewFormData,
  type ReviewFormMode,
  REVIEW_FORM_MODE,
  MAX_CONTENT_LENGTH,
  DEFAULT_RATING,
} from '../schemas';
import { RatingSlider } from './rating-slider';

interface ReviewFormProps {
  onSubmit: (data: ReviewFormData) => void;
  isSubmitting?: boolean;
  initialValues?: Partial<ReviewFormData>;
  mode?: ReviewFormMode;
  isGuest?: boolean;
  className?: string;
}

export function ReviewForm({
  onSubmit,
  isSubmitting = false,
  initialValues,
  mode = REVIEW_FORM_MODE.CREATE,
  isGuest = false,
  className,
}: ReviewFormProps) {
  const { dict } = useTranslation();

  const schema = useMemo(() => createReviewSchema(dict), [dict]);

  const userTouchedRating = useRef(false);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<ReviewFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      content: initialValues?.content ?? '',
      rating: initialValues?.rating ?? DEFAULT_RATING,
      hasSpoiler: initialValues?.hasSpoiler ?? false,
    },
    mode: 'onChange',
  });

  // Sync rating when initialValues loads asynchronously (e.g. userMediaState),
  // but only if the user hasn't manually touched the rating slider yet.
  useEffect(() => {
    if (initialValues?.rating != null && !userTouchedRating.current) {
      setValue('rating', initialValues.rating);
    }
  }, [initialValues?.rating, setValue]);

  const content = watch('content');
  const charactersRemaining = MAX_CONTENT_LENGTH - content.length;
  const hasContent = content.trim().length > 0;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [content]);

  // Merge register with ref for textarea
  const { ref: registerRef, ...registerRest } = register('content');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={cn('space-y-4', className)}>
      {/* Title */}
      <h3 className="text-lg font-medium text-cinema-text-primary">
        {dict.reviews.form.title}
      </h3>

      {/* Rating slider */}
      <div>
        <label className="text-sm text-cinema-text-muted block mb-2">
          {isGuest ? dict.reviews.form.ratingGuest : dict.reviews.form.rating}
        </label>
        <Controller
          name="rating"
          control={control}
          render={({ field }) => (
            <RatingSlider
              value={field.value}
              onChange={(val) => {
                userTouchedRating.current = true;
                field.onChange(val);
              }}
              disabled={isSubmitting}
            />
          )}
        />
      </div>

      {/* Textarea container */}
      <div
        className={cn(
          'rounded-lg border border-cinema-borderSoft/60 bg-cinema-elevated/50 overflow-hidden',
          'transition-all duration-200',
          'hover:border-cinema-border/80',
          'focus-within:ring-2 focus-within:ring-cinema-focus/50 focus-within:border-transparent',
        )}
      >
        <Textarea
          {...registerRest}
          ref={(e) => {
            registerRef(e);
            (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = e;
          }}
          placeholder={dict.reviews.form.placeholder}
          className={cn(
            'min-h-[80px] !border-0 !border-none bg-transparent resize-none text-sm overflow-hidden',
            'text-cinema-text-primary placeholder:text-cinema-text-disabled focus-visible:ring-0 shadow-none',
          )}
          disabled={isSubmitting}
        />

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 pb-3">
          {/* Left: spoiler + counter */}
          <div className="flex items-center gap-4">
            <Controller
              name="hasSpoiler"
              control={control}
              render={({ field }) => (
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="hasSpoiler"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                    className="h-4 w-4"
                  />
                  <label
                    htmlFor="hasSpoiler"
                    className="flex items-center gap-1 text-xs text-cinema-text-muted cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    {dict.reviews.form.spoiler}
                  </label>
                </div>
              )}
            />
            <span
              className={cn(
                'text-xs',
                charactersRemaining < 0
                  ? 'text-red-500'
                  : charactersRemaining < 50
                    ? 'text-yellow-500'
                    : 'text-cinema-text-disabled',
              )}
            >
              {content.length} / {MAX_CONTENT_LENGTH}
            </span>
          </div>

          {/* Right: submit button (only when has content) */}
          {hasContent && (
            <Button
              type="submit"
              size="sm"
              disabled={!isValid || isSubmitting}
              className="h-8 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting
                ? dict.reviews.form.submitting
                : mode === REVIEW_FORM_MODE.CREATE
                  ? dict.reviews.form.submit
                  : dict.reviews.form.save}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
