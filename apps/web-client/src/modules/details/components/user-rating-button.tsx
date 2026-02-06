'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { useAuth, useAuthModalStore } from '@/core/auth';
import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import type { MediaType } from '@/shared/types';
import { useUserMediaState } from '@/modules/saved/hooks/use-me-lists';
import { getRatingColor, getRatingLabel } from '@/modules/reviews/components/rating-slider';
import { RatingDialog } from './rating-dialog';

interface UserRatingButtonProps {
  mediaItemId: string;
  mediaType: MediaType;
}

export function UserRatingButton({ mediaItemId, mediaType }: UserRatingButtonProps) {
  const { dict } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { openLogin } = useAuthModalStore();
  const { data: userMediaState } = useUserMediaState(mediaItemId, isAuthenticated);
  const [dialogOpen, setDialogOpen] = useState(false);

  const currentRating = userMediaState?.rating ?? null;
  const labels = dict.reviews.form.ratingLabels;

  const handleClick = () => {
    if (!isAuthenticated) {
      openLogin();
      return;
    }
    setDialogOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={handleClick}
          aria-label={dict.rating.title}
          className={cn(
            'flex items-center gap-1.5 md:gap-2 bg-cinema-card/60 backdrop-blur-sm px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg w-fit',
            'hover:bg-cinema-card/80 transition-colors cursor-pointer',
          )}
        >
          <Star
            className={cn(
              'w-4 h-4 md:w-5 md:h-5',
              currentRating != null ? 'text-yellow-400 fill-yellow-400' : 'text-cinema-text-muted',
            )}
          />
          {currentRating != null ? (
            <>
              <span className={cn('text-lg md:text-2xl font-bold', getRatingColor(currentRating))}>
                {currentRating}
              </span>
              <span className="text-xs md:text-sm text-cinema-text-muted hidden sm:inline">
                {getRatingLabel(currentRating, labels)}
              </span>
            </>
          ) : (
            <span className="text-xs md:text-sm font-medium text-cinema-text-muted">
              {dict.rating.rate}
            </span>
          )}
        </button>
        <span className="text-[10px] md:text-xs text-cinema-text-muted pl-0.5">
          {dict.rating.title}
        </span>
      </div>

      {dialogOpen && (
        <RatingDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mediaItemId={mediaItemId}
          mediaType={mediaType}
          currentRating={currentRating}
        />
      )}
    </>
  );
}
