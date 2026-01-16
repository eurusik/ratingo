'use client';

import { useMemo, useState, useEffect } from 'react';
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

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn('space-y-4', className)}
    >
      {/* Rating slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-zinc-400">
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

      {/* Content textarea */}
      <div className="space-y-2">
        <Textarea
          {...register('content')}
          placeholder={dict.reviews.form.placeholder}
          className={cn(
            'min-h-[100px] bg-zinc-800/50 border resize-none',
            'text-zinc-200 placeholder-zinc-500',
            errors.content || charactersRemaining < 0 ? 'border-red-500' : 'border-zinc-700',
          )}
          disabled={isSubmitting}
        />
        <div className="flex justify-end">
          <span
            className={cn(
              'text-xs',
              charactersRemaining < 0
                ? 'text-red-500'
                : charactersRemaining < 50
                  ? 'text-yellow-500'
                  : 'text-zinc-500',
            )}
          >
            {charactersRemaining}
          </span>
        </div>
      </div>

      {/* Spoiler checkbox */}
      <Controller
        name="hasSpoiler"
        control={control}
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <Checkbox
              id="hasSpoiler"
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={isSubmitting}
            />
            <label
              htmlFor="hasSpoiler"
              className="flex items-center gap-1.5 text-sm text-zinc-400 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {dict.reviews.form.spoiler}
            </label>
          </div>
        )}
      />

      {/* Submit button */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          {isSubmitting
            ? dict.reviews.form.submitting
            : mode === REVIEW_FORM_MODE.CREATE
              ? dict.reviews.form.submit
              : dict.reviews.form.save}
        </Button>
      </div>
    </form>
  );
}
