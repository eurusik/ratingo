'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import { Button, Slider, Checkbox, Textarea } from '@/shared/ui';
import {
  createReviewSchema,
  type ReviewFormData,
  type ReviewFormMode,
  REVIEW_FORM_MODE,
  MAX_CONTENT_LENGTH,
  MIN_RATING,
  MAX_RATING,
} from '../schemas';

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

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<ReviewFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      content: initialValues?.content ?? '',
      rating: initialValues?.rating ?? 70,
      hasSpoiler: initialValues?.hasSpoiler ?? false,
    },
    mode: 'onChange',
  });

  const content = watch('content');
  const rating = watch('rating');
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

  const currentLabel = useMemo(() => {
    const labels = dict.reviews.form.ratingLabels;
    if (rating >= 85) return labels.excellent;
    if (rating >= 70) return labels.good;
    if (rating >= 50) return labels.okay;
    if (rating >= 30) return labels.meh;
    return labels.bad;
  }, [rating, dict.reviews.form.ratingLabels]);

  const [isLabelAnimating, setIsLabelAnimating] = useState(false);
  const [displayedLabel, setDisplayedLabel] = useState(currentLabel);

  useEffect(() => {
    if (currentLabel !== displayedLabel) {
      setIsLabelAnimating(true);
      const timeout = setTimeout(() => {
        setDisplayedLabel(currentLabel);
        setIsLabelAnimating(false);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [currentLabel, displayedLabel]);

  const getRatingColor = (value: number) => {
    if (value >= 85) return 'text-green-500';
    if (value >= 70) return 'text-lime-500';
    if (value >= 50) return 'text-yellow-500';
    if (value >= 30) return 'text-orange-500';
    return 'text-red-500';
  };

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
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-cinema-text-muted">
            {isGuest ? dict.reviews.form.ratingGuest : dict.reviews.form.rating}
          </label>
          <div className="flex items-center gap-2">
            <span className={cn('text-lg font-bold', getRatingColor(rating))}>
              {rating}
            </span>
            <span
              className={cn(
                'text-sm transition-all duration-150',
                getRatingColor(rating),
                isLabelAnimating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0',
              )}
            >
              {displayedLabel}
            </span>
          </div>
        </div>
        <Controller
          name="rating"
          control={control}
          render={({ field }) => (
            <Slider
              value={[field.value]}
              onValueChange={(values) => field.onChange(values[0])}
              min={MIN_RATING}
              max={MAX_RATING}
              step={1}
              disabled={isSubmitting}
              className="w-full"
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
