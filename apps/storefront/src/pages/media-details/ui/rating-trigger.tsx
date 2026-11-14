'use client';

import { Button } from '@heroui/react';
import { Check, Star } from 'lucide-react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore, scoreFromRating } from '@/shared/lib';
import { presetForRating } from '../model/rating-presets';
import type { MediaRating } from '../model/use-rate-media';
import { HERO_GLASS_BUTTON } from './hero-glass';

export type TriggerLook = 'watched' | 'myScore' | 'compactScore';

const TRIGGER_BASE = 'h-13 gap-2 rounded-full text-base';
const GLASS_TRIGGER = `${TRIGGER_BASE} ${HERO_GLASS_BUTTON} shrink-0 px-4.5 font-semibold`;
const WATCHED_TRIGGER = `${TRIGGER_BASE} min-w-0 flex-1 bg-success-soft px-5 font-bold text-success-soft-foreground md:flex-none data-[hovered=true]:bg-success-soft-hover`;
const COMPACT_TRIGGER = `h-12 shrink-0 gap-2 rounded-full px-4.5 text-[15px] font-semibold ${HERO_GLASS_BUTTON}`;
const MY_SCORE_TRIGGER = `${GLASS_TRIGGER} w-full md:w-auto`;

const TRIGGER_CLASS: Record<TriggerLook, { unrated: string; rated: string }> = {
  watched: { unrated: GLASS_TRIGGER, rated: WATCHED_TRIGGER },
  myScore: { unrated: MY_SCORE_TRIGGER, rated: MY_SCORE_TRIGGER },
  compactScore: { unrated: COMPACT_TRIGGER, rated: COMPACT_TRIGGER },
};

interface RatingTriggerProps {
  rating: MediaRating;
  look: TriggerLook;
  onPress?: () => void;
}

function RatedIcon({ look, emoji }: { look: TriggerLook; emoji?: string }) {
  if (look === 'watched') return <Check aria-hidden className="size-5" />;
  return <span aria-hidden>{emoji}</span>;
}

export function RatingTrigger({ rating, look, onPress }: RatingTriggerProps) {
  const { dict, locale } = useTranslation();

  if (rating.rating === null) {
    return (
      <Button
        variant="secondary"
        aria-haspopup="dialog"
        onPress={onPress}
        className={TRIGGER_CLASS[look].unrated}
      >
        {look === 'compactScore' ? null : <Star aria-hidden className="size-5" />}
        {dict.details.actions.rate}
      </Button>
    );
  }

  const values = { score: formatScore(locale, scoreFromRating(rating.rating)) };
  const { text, label } =
    look === 'watched'
      ? { text: dict.details.actions.watched, label: dict.details.actions.watchedLabel }
      : { text: dict.details.actions.myScore, label: dict.details.actions.myScoreLabel };

  return (
    <Button
      variant="secondary"
      aria-haspopup="dialog"
      aria-label={interpolate(label, values)}
      onPress={onPress}
      className={TRIGGER_CLASS[look].rated}
    >
      <RatedIcon look={look} emoji={presetForRating(rating.rating)?.emoji} />
      {interpolate(text, values)}
    </Button>
  );
}
