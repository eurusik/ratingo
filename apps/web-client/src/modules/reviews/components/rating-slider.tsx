'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/shared/utils';
import { Slider } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { MIN_RATING, MAX_RATING } from '../schemas';

/** Rating quality thresholds (inclusive lower bounds). */
const RATING_THRESHOLDS = {
  EXCELLENT: 85,
  GOOD: 70,
  OKAY: 50,
  MEH: 30,
} as const;

export function getRatingColor(value: number) {
  if (value >= RATING_THRESHOLDS.EXCELLENT) return 'text-green-500';
  if (value >= RATING_THRESHOLDS.GOOD) return 'text-lime-500';
  if (value >= RATING_THRESHOLDS.OKAY) return 'text-yellow-500';
  if (value >= RATING_THRESHOLDS.MEH) return 'text-orange-500';
  return 'text-red-500';
}

export function getRatingLabel(
  value: number,
  labels: { excellent: string; good: string; okay: string; meh: string; bad: string },
) {
  if (value >= RATING_THRESHOLDS.EXCELLENT) return labels.excellent;
  if (value >= RATING_THRESHOLDS.GOOD) return labels.good;
  if (value >= RATING_THRESHOLDS.OKAY) return labels.okay;
  if (value >= RATING_THRESHOLDS.MEH) return labels.meh;
  return labels.bad;
}

interface RatingSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export function RatingSlider({ value, onChange, disabled, className }: RatingSliderProps) {
  const { dict } = useTranslation();
  const labels = dict.reviews.form.ratingLabels;

  const currentLabel = useMemo(() => getRatingLabel(value, labels), [value, labels]);

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

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className={cn('text-lg font-bold', getRatingColor(value))}>{value}</span>
        <span
          className={cn(
            'text-sm text-cinema-text-muted transition-all duration-150',
            isLabelAnimating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0',
          )}
        >
          {displayedLabel}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        min={MIN_RATING}
        max={MAX_RATING}
        step={1}
        disabled={disabled}
        className="w-full"
      />
    </div>
  );
}
