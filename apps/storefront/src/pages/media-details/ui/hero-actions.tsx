'use client';

import { useId } from 'react';
import { Button, Skeleton } from '@heroui/react';
import { Bell, Check, Star } from 'lucide-react';
import { useAuth } from '@ratingo/web-core/auth';
import { WantToWatchButton } from '@/features/save-to-library';
import type { MediaType } from '@/shared/api';
import { mediaRoute } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore, scoreFromPercent } from '@/shared/lib';
import { formatCount } from '../model/details-format';
import { presetForRating } from '../model/rating-presets';
import { useRateMedia, type MediaRating } from '../model/use-rate-media';
import { RatingDialog } from './rating-dialog';
import { ShareButton } from './share-button';

export interface ActionMedia {
  mediaItemId: string;
  type: MediaType;
  slug: string;
  title: string;
  seasonCount?: number;
  episodeCount?: number;
}

type TriggerLook = 'watched' | 'secondary';

const TRIGGER_CLASSES: Record<TriggerLook, string> = {
  watched:
    'min-w-0 flex-1 bg-success-soft px-5 font-bold text-success md:flex-none data-[hovered=true]:bg-success-soft-hover',
  secondary: 'shrink-0 px-4.5 font-semibold text-foreground',
};

interface RatingTriggerProps {
  rating: MediaRating;
  look: TriggerLook;
  onPress?: () => void;
}

function RatingTrigger({ rating, look, onPress }: RatingTriggerProps) {
  const { dict, locale } = useTranslation();
  const score = scoreFromPercent(rating.rating);
  const preset = rating.rating === null ? undefined : presetForRating(rating.rating);
  const shown = score === undefined ? undefined : formatScore(locale, score);

  const content =
    shown === undefined ? (
      <>
        <Star aria-hidden className="size-5" />
        {dict.details.actions.rate}
      </>
    ) : look === 'watched' ? (
      <>
        <Check aria-hidden className="size-5" />
        {interpolate(dict.details.actions.watched, { score: shown })}
      </>
    ) : (
      <>
        <span aria-hidden>{preset?.emoji}</span>
        {interpolate(dict.details.actions.myScore, { score: shown })}
      </>
    );
  const label =
    shown === undefined
      ? undefined
      : interpolate(
          look === 'watched'
            ? dict.details.actions.watchedLabel
            : dict.details.actions.myScoreLabel,
          { score: shown },
        );

  return (
    <Button
      variant="secondary"
      aria-haspopup="dialog"
      aria-label={label}
      onPress={onPress}
      className={`h-13 gap-2 rounded-full text-base ${TRIGGER_CLASSES[shown === undefined ? 'secondary' : look]}`}
    >
      {content}
    </Button>
  );
}

function DesktopShare({ media }: { media: ActionMedia }) {
  return (
    <ShareButton
      href={mediaRoute(media.type, media.slug)}
      title={media.title}
      className="hidden size-13 rounded-full md:flex"
    />
  );
}

function ActionsSkeleton() {
  return <Skeleton className="h-13 w-full rounded-full md:w-80" />;
}

function MovieActions({ media }: { media: ActionMedia }) {
  const rating = useRateMedia(media);
  const isWatched = rating.rating !== null;

  if (rating.isResolving) return <ActionsSkeleton />;

  return (
    <div className="flex items-center gap-2.5">
      {isWatched ? null : <WantToWatchButton media={media} className="flex-1 md:flex-none" />}
      <RatingDialog
        type={media.type}
        title={media.title}
        rating={rating}
        trigger={<RatingTrigger rating={rating} look="watched" />}
      />
      <DesktopShare media={media} />
    </div>
  );
}

function GuestTracking({ media }: { media: ActionMedia }) {
  const { dict } = useTranslation();
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-[20px] bg-surface p-4"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
        >
          <Bell className="size-5.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-[17px] font-extrabold">
            {dict.details.guest.title}
          </h2>
          <p className="mt-1 text-sm leading-snug text-muted">{dict.details.guest.text}</p>
        </div>
      </div>
      <WantToWatchButton media={media} label={dict.details.guest.action} className="w-full" />
      <p className="text-center text-xs text-muted">{dict.details.guest.hint}</p>
    </section>
  );
}

function StartTracking({ media }: { media: ActionMedia }) {
  const { dict, locale } = useTranslation();
  const headingId = useId();
  const rating = useRateMedia(media);
  const facts = [
    media.seasonCount && formatCount(media.seasonCount, dict.details.seasons, locale),
    media.episodeCount && formatCount(media.episodeCount, dict.details.episodes, locale),
  ].filter(Boolean);

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-[20px] bg-surface p-4"
    >
      <div>
        <h2 id={headingId} className="text-[17px] font-extrabold">
          {dict.details.start.title}
        </h2>
        {facts.length > 0 ? (
          <p className="mt-1 text-sm text-muted tabular-nums">{facts.join(' · ')}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2.5">
        <WantToWatchButton media={media} className="flex-1" />
        {rating.isResolving ? (
          <Skeleton className="h-13 w-32 rounded-full" />
        ) : (
          <RatingDialog
            type={media.type}
            title={media.title}
            rating={rating}
            trigger={<RatingTrigger rating={rating} look="secondary" />}
          />
        )}
        <DesktopShare media={media} />
      </div>
    </section>
  );
}

function ShowActions({ media }: { media: ActionMedia }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <ActionsSkeleton />;
  return isAuthenticated ? <StartTracking media={media} /> : <GuestTracking media={media} />;
}

export function HeroActions({ media }: { media: ActionMedia }) {
  return media.type === 'movie' ? <MovieActions media={media} /> : <ShowActions media={media} />;
}
