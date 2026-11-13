'use client';

import { Button, Skeleton } from '@heroui/react';
import { Bell, Check, Star } from 'lucide-react';
import { useAuth } from '@ratingo/web-core/auth';
import { WantToWatchButton } from '@/features/save-to-library';
import { mediaRoute } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore, scoreFromPercent } from '@/shared/lib';
import { formatCount } from '../model/details-format';
import type { MediaDetailsView, MovieDetailsView, ShowDetailsView } from '../model/details-view';
import { presetForRating } from '../model/rating-presets';
import { useRateMedia, type MediaRating } from '../model/use-rate-media';
import { RatingDialog } from './rating-dialog';
import { ShareButton } from './share-button';

const SECONDARY_ACTION =
  'h-13 shrink-0 gap-2 rounded-full px-4.5 text-base font-semibold text-foreground';

function RateTrigger({ rating, onPress }: { rating: MediaRating; onPress?: () => void }) {
  const { dict, locale } = useTranslation();
  const score = scoreFromPercent(rating.rating);
  const preset = rating.rating === null ? undefined : presetForRating(rating.rating);

  if (score === undefined || !preset) {
    return (
      <Button
        variant="secondary"
        aria-haspopup="dialog"
        className={SECONDARY_ACTION}
        onPress={onPress}
      >
        <Star aria-hidden className="size-5" />
        {dict.details.actions.rate}
      </Button>
    );
  }

  const shown = formatScore(locale, score);
  return (
    <Button
      variant="secondary"
      aria-haspopup="dialog"
      aria-label={interpolate(dict.details.actions.myScoreLabel, { score: shown })}
      className={`${SECONDARY_ACTION} text-success`}
      onPress={onPress}
    >
      <span aria-hidden>{preset.emoji}</span>
      {interpolate(dict.details.actions.myScore, { score: shown })}
    </Button>
  );
}

function WatchedTrigger({ score, onPress }: { score: number; onPress?: () => void }) {
  const { dict, locale } = useTranslation();
  const shown = formatScore(locale, score);

  return (
    <Button
      aria-haspopup="dialog"
      aria-label={interpolate(dict.details.actions.watchedLabel, { score: shown })}
      className="h-13 min-w-0 flex-1 gap-2 rounded-full bg-success-soft px-5 text-base font-bold text-success md:flex-none"
      onPress={onPress}
    >
      <Check aria-hidden className="size-5" />
      {interpolate(dict.details.actions.watched, { score: shown })}
    </Button>
  );
}

function DesktopShare({ view }: { view: MediaDetailsView }) {
  return (
    <ShareButton
      href={mediaRoute(view.type, view.slug)}
      title={view.title}
      className="hidden size-13 rounded-full md:flex"
    />
  );
}

function ActionsSkeleton() {
  return <Skeleton className="h-13 w-full rounded-full md:w-80" />;
}

function MovieActions({ view }: { view: MovieDetailsView }) {
  const rating = useRateMedia(view);
  const watchedScore = scoreFromPercent(rating.rating);

  if (rating.isResolving) return <ActionsSkeleton />;

  return (
    <div className="flex items-center gap-2.5">
      {watchedScore === undefined ? (
        <>
          <WantToWatchButton media={view} className="flex-1 md:flex-none" />
          <RatingDialog
            type={view.type}
            title={view.title}
            rating={rating}
            trigger={<RateTrigger rating={rating} />}
          />
        </>
      ) : (
        <RatingDialog
          type={view.type}
          title={view.title}
          rating={rating}
          trigger={<WatchedTrigger score={watchedScore} />}
        />
      )}
      <DesktopShare view={view} />
    </div>
  );
}

function GuestTracking({ view }: { view: ShowDetailsView }) {
  const { dict } = useTranslation();

  return (
    <section
      aria-labelledby="guest-tracking-title"
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
          <h2 id="guest-tracking-title" className="text-[17px] font-extrabold">
            {dict.details.guest.title}
          </h2>
          <p className="mt-1 text-sm leading-snug text-muted">{dict.details.guest.text}</p>
        </div>
      </div>
      <WantToWatchButton media={view} label={dict.details.guest.action} className="w-full" />
      <p className="text-center text-xs text-muted">{dict.details.guest.hint}</p>
    </section>
  );
}

function StartTracking({ view }: { view: ShowDetailsView }) {
  const { dict, locale } = useTranslation();
  const rating = useRateMedia(view);
  const facts = [
    view.seasonCount && formatCount(view.seasonCount, dict.details.seasons, locale),
    view.episodeCount && formatCount(view.episodeCount, dict.details.episodes, locale),
  ].filter(Boolean);

  return (
    <section
      aria-labelledby="start-tracking-title"
      className="flex flex-col gap-3 rounded-[20px] bg-surface p-4"
    >
      <div>
        <h2 id="start-tracking-title" className="text-[17px] font-extrabold">
          {dict.details.start.title}
        </h2>
        {facts.length > 0 ? (
          <p className="mt-1 text-sm text-muted tabular-nums">{facts.join(' · ')}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2.5">
        <WantToWatchButton media={view} className="flex-1" />
        {rating.isResolving ? (
          <Skeleton className="h-13 w-32 rounded-full" />
        ) : (
          <RatingDialog
            type={view.type}
            title={view.title}
            rating={rating}
            trigger={<RateTrigger rating={rating} />}
          />
        )}
        <DesktopShare view={view} />
      </div>
    </section>
  );
}

function ShowActions({ view }: { view: ShowDetailsView }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <ActionsSkeleton />;
  return isAuthenticated ? <StartTracking view={view} /> : <GuestTracking view={view} />;
}

export function HeroActions({ view }: { view: MediaDetailsView }) {
  return view.type === 'movie' ? <MovieActions view={view} /> : <ShowActions view={view} />;
}
