'use client';

import { Bell } from 'lucide-react';
import { useAuth } from '@ratingo/web-core/auth';
import { ReminderToggle, type ReminderTrigger } from '@/features/media-reminder';
import { SaveToWatchCta, WantToWatchButton } from '@/features/save-to-library';
import { useTranslation } from '@/shared/i18n';
import { useRateMedia } from '../model/use-rate-media';
import type { ActionMedia } from '../model/action-media';
import { ActionsSkeleton } from './actions-skeleton';
import { RatingTrigger } from './rating-trigger';
import { DesktopMoreMenu } from './more-menu';
import { TrackingCard } from './tracking-card';
import { RatingDialog } from './rating-dialog';
import { ShowActionsSkeleton } from './show-actions-skeleton';
import { ShowTracking } from './show-tracking';

export type { ActionMedia } from '../model/action-media';

function upcomingReminderOf(media: ActionMedia): ReminderTrigger | undefined {
  if (media.type === 'show') return 'premiere';
  return media.upcoming === 'dated' ? 'release' : undefined;
}

function UpcomingActions({ media }: { media: ActionMedia }) {
  const reminder = upcomingReminderOf(media);
  return (
    <div className="flex items-center gap-2.5">
      <WantToWatchButton media={media} className="flex-1 md:flex-none" />
      {reminder ? (
        <ReminderToggle
          media={{ mediaItemId: media.mediaItemId, title: media.title }}
          trigger={reminder}
          look="button"
        />
      ) : null}
      <DesktopMoreMenu media={media} />
    </div>
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
      <DesktopMoreMenu media={media} />
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

function ShowActions({ media }: { media: ActionMedia }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <ShowActionsSkeleton state={media.trackingState ?? 'guest'} />;
  if (!isAuthenticated) return <GuestTracking media={media} />;
  return <ShowTracking media={media} />;
}

function MediaActions({ media }: { media: ActionMedia }) {
  if (media.upcoming) return <UpcomingActions media={media} />;
  if (media.type === 'show') return <ShowActions media={media} />;
  return <MovieActions media={media} />;
}

export function HeroActions({ media }: { media: ActionMedia }) {
  return <MediaActions media={media} />;
}
