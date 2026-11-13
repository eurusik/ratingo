'use client';

import { useState } from 'react';
import { Button, Label, Slider, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import type { MediaType } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore, percentFromScore, scoreFromPercent } from '@/shared/lib';
import {
  RATING_MAX,
  RATING_MIN,
  RATING_PRESETS,
  RATING_STEP,
  findPreset,
  presetForRating,
} from '../model/rating-presets';
import type { MediaRating } from '../model/use-rate-media';

const SCORE_MIN = scoreFromPercent(RATING_MIN) ?? 0;
const SCORE_MAX = scoreFromPercent(RATING_MAX) ?? 0;
const SCORE_STEP = scoreFromPercent(RATING_STEP) ?? 0;

export interface RatingPanelProps {
  type: MediaType;
  title: string;
  rating: MediaRating;
  onDone: () => void;
}

export function RatingPanel({ type, title, rating, onDone }: RatingPanelProps) {
  const { dict, locale } = useTranslation();
  const [draftScore, setDraftScore] = useState<number | null>(null);
  const savedScore = scoreFromPercent(rating.rating);
  const shownScore = draftScore ?? savedScore;
  const picked = rating.rating === null ? undefined : presetForRating(rating.rating);
  const subtitle = type === 'show' ? `${title} · ${dict.details.rate.showHint}` : title;

  const commitScore = (score: number) => {
    setDraftScore(null);
    rating.rate(Math.round(percentFromScore(score)));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted">{subtitle}</p>
        {rating.rating === null ? null : (
          <Button
            variant="ghost"
            className="min-h-11 shrink-0 text-danger"
            onPress={() => {
              rating.clear();
              onDone();
            }}
          >
            {dict.details.rate.clear}
          </Button>
        )}
      </div>
      <ToggleButtonGroup
        aria-label={dict.details.rate.presetsLabel}
        selectionMode="single"
        isDetached
        fullWidth
        selectedKeys={picked ? [picked.id] : []}
        onSelectionChange={(keys) => {
          const [id] = [...keys];
          const preset = typeof id === 'string' ? findPreset(id) : undefined;
          if (preset) {
            setDraftScore(null);
            rating.rate(preset.score);
          }
        }}
        className="grid grid-cols-4 gap-2"
      >
        {RATING_PRESETS.map((preset) => (
          <ToggleButton
            key={preset.id}
            id={preset.id}
            className="h-auto min-h-23 min-w-0 flex-col gap-1 rounded-[18px] border-2 border-transparent bg-default px-1 py-2 data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft data-[selected=true]:text-foreground"
          >
            <span aria-hidden className="text-3xl leading-none">
              {preset.emoji}
            </span>
            <span className="line-clamp-2 max-w-full text-center text-xs leading-tight font-bold break-words">
              {dict.details.rate.presets[preset.id]}
            </span>
            <span className="text-xs font-semibold text-muted tabular-nums">
              {formatScore(locale, scoreFromPercent(preset.score) ?? 0)}
            </span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Slider
        minValue={SCORE_MIN}
        maxValue={SCORE_MAX}
        step={SCORE_STEP}
        value={shownScore ?? SCORE_MIN}
        onChange={(score) => typeof score === 'number' && setDraftScore(score)}
        onChangeEnd={(score) => typeof score === 'number' && commitScore(score)}
        formatOptions={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
        className="gap-2.5"
      >
        <div className="flex items-center">
          <Label className="flex-1 text-sm font-semibold text-foreground/85">
            {dict.details.rate.fineTune}
          </Label>
          <Slider.Output className="text-[15px] font-extrabold tabular-nums">
            {shownScore === undefined
              ? dict.details.rate.notRated
              : interpolate(dict.details.rate.outOf, { score: formatScore(locale, shownScore) })}
          </Slider.Output>
        </div>
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      <Button size="lg" className="h-13 w-full rounded-full text-base font-bold" onPress={onDone}>
        {dict.details.rate.done}
      </Button>
    </div>
  );
}
