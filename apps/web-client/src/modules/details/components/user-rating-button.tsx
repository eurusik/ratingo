'use client';

import { useAuth } from '@/core/auth';
import { useTranslation } from '@/shared/i18n';
import type { MediaType } from '@/shared/types';
import { useUserMediaState } from '@/modules/saved/hooks/use-me-lists';
import { RatingPresets } from './rating-presets';

interface UserRatingButtonProps {
  mediaItemId: string;
  mediaType: MediaType;
}

export function UserRatingButton({ mediaItemId, mediaType }: UserRatingButtonProps) {
  const { dict } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { data: userMediaState } = useUserMediaState(mediaItemId, isAuthenticated);

  const hasRating = userMediaState?.rating != null;

  return (
    <div className="space-y-1">
      {hasRating && (
        <span className="text-[10px] md:text-xs text-cinema-text-muted">
          {dict.rating.title}
        </span>
      )}
      <RatingPresets mediaItemId={mediaItemId} mediaType={mediaType} />
    </div>
  );
}
