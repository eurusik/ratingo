'use client';

import { Bell } from 'lucide-react';
import { useAuth } from '@ratingo/web-core/auth';
import { RemoveFromLibraryButton } from '@/features/remove-from-library';
import { SaveToWatchCta, WantToWatchButton } from '@/features/save-to-library';
import { useTranslation } from '@/shared/i18n';
import { useRateMedia } from '../model/use-rate-media';
import type { ActionMedia } from '../model/action-media';
import { ActionsSkeleton } from './actions-skeleton';
import { RatingTrigger } from './rating-trigger';
import { DesktopShare } from './share-button';
import { TrackingCard } from './tracking-card';
import { RatingDialog } from './rating-dialog';
import { ShowActionsSkeleton } from './show-actions-skeleton';
import { ShowTracking } from './show-tracking';

export type { ActionMedia } from '../model/action-media';

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

function ShowActions({ media }: { media: ActionMedia }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <ShowActionsSkeleton state={media.trackingState ?? 'guest'} />;
  if (!isAuthenticated) return <GuestTracking media={media} />;
  return <ShowTracking media={media} />;
}

export function HeroActions({ media }: { media: ActionMedia }) {
  return (
    <div className="flex flex-col gap-2">
      {media.type === 'movie' ? <MovieActions media={media} /> : <ShowActions media={media} />}
      <RemoveFromLibraryButton media={media} />
    </div>
  );
}
