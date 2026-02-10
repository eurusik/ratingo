/**
 * Community average rating — secondary indicator below Ratingo Score.
 * Visually subdued to avoid competing with the hero metric.
 */

'use client';

import type { components } from '@ratingo/api-contract';
import { Star } from 'lucide-react';
import { formatRating, pluralize } from '@/shared/utils';
import { useTranslation } from '@/shared/i18n';
import { COMMUNITY_RATING_MIN_THRESHOLD } from '../constants/community-rating';
import { RecentRaters } from './recent-raters';

type RecentRaterDto = components['schemas']['RecentRaterDto'];

interface CommunityRatingProps {
  averageRating: number;
  ratingCount: number;
  recentRaters?: RecentRaterDto[];
}

export function CommunityRating({ averageRating, ratingCount, recentRaters }: CommunityRatingProps) {
  const { dict } = useTranslation();

  if (ratingCount < COMMUNITY_RATING_MIN_THRESHOLD) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 pl-0.5">
        <Star className="w-3 h-3 text-yellow-400/70 fill-yellow-400/70" />
        <span className="text-xs text-cinema-text-secondary">
          {dict.details.communityRating.label}:
        </span>
        <span className="text-xs font-medium text-cinema-text-muted">
          {formatRating(averageRating)}
        </span>
        <span className="text-cinema-text-muted/50 text-[10px]">&middot;</span>
        <span className="text-[10px] text-cinema-text-muted/70">
          {ratingCount} {pluralize(ratingCount, dict.details.communityRating.ratings)}
        </span>
      </div>
      <RecentRaters raters={recentRaters ?? []} totalCount={ratingCount} />
    </div>
  );
}
