'use client';

import { useState, type ReactElement } from 'react';
import { Button, Label, Popover, Slider, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { useSignedInAction } from '@/shared/auth';
import { interpolate, useTranslation } from '@/shared/i18n';
import { DESKTOP_MEDIA_QUERY, formatScore, scoreFromPercent, useMediaQuery } from '@/shared/lib';
import { Sheet } from '@/shared/ui';
import type { MediaType } from '@/shared/api';
import {
  RATING_MAX,
  RATING_MIN,
  RATING_PRESETS,
  RATING_STEP,
  findPreset,
  presetForRating,
} from '../model/rating-presets';
import type { MediaRating } from '../model/use-rate-media';

interface RatingPanelProps {
  type: MediaType;
  title: string;
  rating: MediaRating;
  onDone: () => void;
}

function RatingPanel({ type, title, rating, onDone }: RatingPanelProps) {
  const { dict, locale } = useTranslation();
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? rating.rating;
  const picked = shown === null ? undefined : presetForRating(shown);
  const shownScore = scoreFromPercent(shown);
  const subtitle = type === 'show' ? `${title} · ${dict.details.rate.showHint}` : title;

  const commit = (value: number) => {
    setDraft(null);
    rating.rate(value);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted">{subtitle}</p>
        {rating.rating === null ? null : (
          <Button
            variant="ghost"
            size="sm"
            className="-my-1.5 shrink-0 text-danger"
            onPress={() => {
              rating.rate(null);
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
          if (preset) commit(preset.score);
        }}
        className="grid grid-cols-4 gap-2"
      >
        {RATING_PRESETS.map((preset) => (
          <ToggleButton
            key={preset.id}
            id={preset.id}
            className="h-23 min-w-0 flex-col gap-1 rounded-[18px] border-2 border-transparent bg-default px-1 data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft data-[selected=true]:text-foreground"
          >
            <span aria-hidden className="text-3xl leading-none">
              {preset.emoji}
            </span>
            <span className="max-w-full truncate text-xs font-bold">
              {dict.details.rate.presets[preset.id]}
            </span>
            <span className="text-xs font-semibold text-muted tabular-nums">
              {formatScore(locale, preset.score / 10)}
            </span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Slider
        minValue={RATING_MIN}
        maxValue={RATING_MAX}
        step={RATING_STEP}
        value={shown ?? RATING_MIN}
        onChange={(value) => typeof value === 'number' && setDraft(value)}
        onChangeEnd={(value) => typeof value === 'number' && commit(value)}
        formatOptions={{ maximumFractionDigits: 1 }}
        className="gap-2.5"
      >
        <div className="flex items-center">
          <Label className="flex-1 text-sm font-semibold text-foreground/85">
            {dict.details.rate.fineTune}
          </Label>
          <Slider.Output className="text-[15px] font-extrabold tabular-nums">
            {shownScore === undefined
              ? '—'
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

interface RatingDialogProps {
  type: MediaType;
  title: string;
  rating: MediaRating;
  trigger: ReactElement<{ onPress?: () => void }>;
}

export function RatingDialog({ type, title, rating, trigger }: RatingDialogProps) {
  const { dict } = useTranslation();
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const runSignedIn = useSignedInAction();
  const [isOpen, setIsOpen] = useState(false);
  const heading = dict.details.rate.title[type];
  const close = () => setIsOpen(false);
  const changeOpen = (next: boolean) => {
    if (next) runSignedIn(() => setIsOpen(true));
    else close();
  };
  const panel = <RatingPanel type={type} title={title} rating={rating} onDone={close} />;

  if (!isDesktop) {
    return (
      <Sheet trigger={trigger} isOpen={isOpen} onOpenChange={changeOpen} title={heading}>
        {panel}
      </Sheet>
    );
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={changeOpen}>
      {trigger}
      <Popover.Content placement="bottom start" className="w-104">
        <Popover.Dialog className="flex flex-col gap-1">
          <Popover.Heading className="text-lg font-extrabold">{heading}</Popover.Heading>
          {panel}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
