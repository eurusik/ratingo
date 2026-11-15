'use client';

import { Dropdown, Label, type Key } from '@heroui/react';
import { RATING_PRESETS, presetForRating } from '@/entities/library';
import { formatScore, scoreFromRating } from '@/shared/lib';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { LibraryTitle } from '../model/library-title';

interface RatingPickerProps {
  title: LibraryTitle;
  rating: number | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onRate: (rating: number) => void;
}

const TRIGGER_CLASS =
  'inline-flex min-h-tap shrink-0 items-center gap-1 rounded-full px-3 text-sm font-extrabold tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-focus';

export function RatingPicker({ title, rating, isOpen, onOpenChange, onRate }: RatingPickerProps) {
  const { dict, locale } = useTranslation();
  const preset = rating === null ? undefined : presetForRating(rating);
  const score = rating === null ? undefined : formatScore(locale, scoreFromRating(rating));

  return (
    <Dropdown isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dropdown.Trigger
        aria-label={
          score === undefined
            ? interpolate(dict.my.history.rateLabel, { title: title.title })
            : interpolate(dict.my.history.yourRatingFor, { score, title: title.title })
        }
        className={
          score === undefined
            ? `${TRIGGER_CLASS} bg-accent-soft text-accent-soft-foreground`
            : `${TRIGGER_CLASS} bg-default text-foreground`
        }
      >
        {score === undefined ? (
          dict.my.history.rate
        ) : (
          <>
            <span aria-hidden>{preset?.emoji}</span>
            {score}
          </>
        )}
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          aria-label={dict.my.actions.rating}
          onAction={(key: Key) => {
            const picked = RATING_PRESETS.find((option) => option.id === key);
            if (picked) onRate(picked.score);
          }}
        >
          {RATING_PRESETS.map((option) => (
            <Dropdown.Item
              key={option.id}
              id={option.id}
              textValue={formatScore(locale, scoreFromRating(option.score))}
            >
              <Label className="flex items-center gap-2 tabular-nums">
                <span aria-hidden className="text-lg">
                  {option.emoji}
                </span>
                {formatScore(locale, scoreFromRating(option.score))}
              </Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
