'use client';

import { useId, type ReactNode } from 'react';
import { Button, Skeleton } from '@heroui/react';
import { Bell, Check, Star } from 'lucide-react';
import { useAuth } from '@ratingo/web-core/auth';
import { SaveToWatchCta, WantToWatchButton } from '@/features/save-to-library';
import type { MediaType } from '@/shared/api';
import { mediaRoute } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore, scoreFromRating } from '@/shared/lib';
import { ACTIONS_SKELETON_SIZE } from '../model/actions-skeleton-size';
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

type TriggerLook = 'watched' | 'myScore';

const GLASS_BUTTON = 'poster-glass data-[hovered=true]:bg-background';
const TRIGGER_BASE = 'h-13 gap-2 rounded-full text-base';
const GLASS_TRIGGER = `${TRIGGER_BASE} ${GLASS_BUTTON} shrink-0 px-4.5 font-semibold`;
const WATCHED_TRIGGER = `${TRIGGER_BASE} min-w-0 flex-1 bg-success-soft px-5 font-bold text-success-soft-foreground md:flex-none data-[hovered=true]:bg-success-soft-hover`;
const MY_SCORE_TRIGGER = `${GLASS_TRIGGER} w-full md:w-auto`;

const TRIGGER_CLASS: Record<TriggerLook, { unrated: string; rated: string }> = {
  watched: { unrated: GLASS_TRIGGER, rated: WATCHED_TRIGGER },
  myScore: { unrated: MY_SCORE_TRIGGER, rated: MY_SCORE_TRIGGER },
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

function RatingTrigger({ rating, look, onPress }: RatingTriggerProps) {
  const { dict, locale } = useTranslation();

  if (rating.rating === null) {
    return (
      <Button
        variant="secondary"
        aria-haspopup="dialog"
        onPress={onPress}
        className={TRIGGER_CLASS[look].unrated}
      >
        <Star aria-hidden className="size-5" />
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

function DesktopShare({ media }: { media: ActionMedia }) {
  return (
    <ShareButton
      href={mediaRoute(media.type, media.slug)}
      title={media.title}
      className={`hidden size-13 rounded-full md:flex ${GLASS_BUTTON}`}
    />
  );
}

function ActionsSkeleton({ type }: { type: MediaType }) {
  return <Skeleton className={ACTIONS_SKELETON_SIZE[type]} />;
}

function TrackingCard({ children }: { children: (headingId: string) => ReactNode }) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-3xl bg-surface/45 p-4 backdrop-blur-xl"
    >
      {children(headingId)}
    </section>
  );
}

function MovieActions({ media }: { media: ActionMedia }) {
  const rating = useRateMedia(media);
  const isWatched = rating.rating !== null;

  if (rating.isResolving) return <ActionsSkeleton type="movie" />;

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

  return (
    <TrackingCard>
      {(headingId) => (
        <>
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
          <SaveToWatchCta media={media} label={dict.details.guest.action} className="w-full" />
          <p className="text-center text-xs text-muted">{dict.details.guest.hint}</p>
        </>
      )}
    </TrackingCard>
  );
}

function StartTracking({ media }: { media: ActionMedia }) {
  const { dict, locale } = useTranslation();
  const rating = useRateMedia(media);
  const facts = [
    media.seasonCount && formatCount(media.seasonCount, dict.details.seasons, locale),
    media.episodeCount && formatCount(media.episodeCount, dict.details.episodes, locale),
  ].filter(Boolean);

  return (
    <TrackingCard>
      {(headingId) => (
        <>
          <div>
            <h2 id={headingId} className="text-[17px] font-extrabold">
              {dict.details.start.title}
            </h2>
            {facts.length > 0 ? (
              <p className="mt-1 text-sm text-muted tabular-nums">{facts.join(' · ')}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
            <WantToWatchButton media={media} className="w-full md:w-auto md:flex-1" />
            {rating.isResolving ? (
              <Skeleton className="h-13 w-full shrink-0 rounded-full md:w-32" />
            ) : (
              <RatingDialog
                type={media.type}
                title={media.title}
                rating={rating}
                trigger={<RatingTrigger rating={rating} look="myScore" />}
              />
            )}
            <DesktopShare media={media} />
          </div>
        </>
      )}
    </TrackingCard>
  );
}

function ShowActions({ media }: { media: ActionMedia }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <ActionsSkeleton type="show" />;
  return isAuthenticated ? <StartTracking media={media} /> : <GuestTracking media={media} />;
}

export function HeroActions({ media }: { media: ActionMedia }) {
  return media.type === 'movie' ? <MovieActions media={media} /> : <ShowActions media={media} />;
}
