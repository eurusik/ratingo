'use client';

import { useCallback, useState } from 'react';
import { Button, Label, Slider, ToggleButton, ToggleButtonGroup, type Key } from '@heroui/react';
import type { MediaType } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore, percentFromScore, scoreFromPercent, scoreFromRating } from '@/shared/lib';
import {
  RATING_MAX,
  RATING_MIN,
  RATING_PRESETS,
  RATING_STEP,
  findPreset,
  presetForRating,
} from '../model/rating-presets';
import { useDelayedSave } from '../model/use-delayed-save';
import type { MediaRating } from '../model/use-rate-media';

const SCORE_MIN = scoreFromRating(RATING_MIN);
const SCORE_MAX = scoreFromRating(RATING_MAX);
const SCORE_STEP = scoreFromRating(RATING_STEP);
const SLIDER_SAVE_DELAY_MS = 400;
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
  const picked =
    shownScore === undefined ? undefined : presetForRating(percentFromScore(shownScore));
  const subtitle = type === 'show' ? `${title} · ${dict.details.rate.showHint}` : title;

  const { rate } = rating;
  const saveScore = useCallback(
    (score: number) => {
      setDraftScore(null);
      rate(Math.round(percentFromScore(score)));
    },
    [rate],
  );
  const delayedSave = useDelayedSave(saveScore, SLIDER_SAVE_DELAY_MS);

  const ratePreset = (keys: Set<Key>) => {
    const [id] = [...keys];
    const preset = typeof id === 'string' ? findPreset(id) : undefined;
    if (!preset) return;
    delayedSave.cancel();
    setDraftScore(null);
    rate(preset.score);
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
              delayedSave.cancel();
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
        onSelectionChange={ratePreset}
        className="grid grid-cols-4 gap-1.5"
      >
        {RATING_PRESETS.map((preset) => (
          <ToggleButton
            key={preset.id}
            id={preset.id}
            className="h-23 w-full min-w-0 flex-col gap-1 rounded-[18px] border-2 border-transparent bg-default px-0.5 data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft data-[selected=true]:text-foreground"
          >
            <span aria-hidden className="text-3xl leading-none">
              {preset.emoji}
            </span>
            <span className="max-w-full truncate text-[clamp(10px,2.9vw,11px)] leading-tight font-bold tracking-tight">
              {dict.details.rate.presets[preset.id]}
            </span>
            <span className="text-xs font-semibold text-muted tabular-nums">
              {formatScore(locale, scoreFromRating(preset.score))}
            </span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Slider
        minValue={SCORE_MIN}
        maxValue={SCORE_MAX}
        step={SCORE_STEP}
        value={shownScore ?? SCORE_MIN}
        onChange={(score) => {
          if (typeof score !== 'number') return;
          delayedSave.cancel();
          setDraftScore(score);
        }}
        onChangeEnd={(score) => typeof score === 'number' && delayedSave.schedule(score)}
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
          {shownScore === undefined ? null : <Slider.Fill />}
          <Slider.Thumb className={shownScore === undefined ? 'opacity-60' : undefined} />
        </Slider.Track>
      </Slider>
      <Button size="lg" className="h-13 w-full rounded-full text-base font-bold" onPress={onDone}>
        {dict.details.rate.done}
      </Button>
    </div>
  );
}
