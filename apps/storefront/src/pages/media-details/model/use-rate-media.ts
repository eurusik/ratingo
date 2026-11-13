'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { useLibrarySave } from '@/features/save-to-library';
import { LIBRARY_QUERY_KEY, useMediaState, useMediaStateStore } from '@/entities/library';
import { libraryApi, type MediaType, type WatchState } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore, scoreFromPercent } from '@/shared/lib';
import { presetForRating } from './rating-presets';

interface RatableMedia {
  mediaItemId: string;
  type: MediaType;
  title: string;
}

const STATES_KEPT_ON_RATING = new Set<WatchState>(['watching', 'paused', 'caught_up']);

export interface MediaRating {
  rating: number | null;
  isResolving: boolean;
  rate: (rating: number | null) => void;
}

export function useRateMedia(media: RatableMedia): MediaRating {
  const { dict, locale } = useTranslation();
  const store = useMediaStateStore();
  const { removeIfSaved } = useLibrarySave();
  const { mediaState, isResolving } = useMediaState(media.mediaItemId);

  const { mutate, isPending, variables } = useMutation({
    mutationKey: [...LIBRARY_QUERY_KEY, 'rate', media.mediaItemId],
    scope: { id: `rate:${media.mediaItemId}` },
    mutationFn: (rating: number | null) =>
      libraryApi.setRating(media.mediaItemId, rating, media.type),
    onMutate: () => ({ stateBefore: store.read(media.mediaItemId)?.state }),
    onSuccess: (saved, rating, context) => {
      store.write(media.mediaItemId, saved);
      if (
        rating === null ||
        (context.stateBefore && STATES_KEPT_ON_RATING.has(context.stateBefore))
      )
        return;
      const preset = presetForRating(rating);
      const score = scoreFromPercent(rating);
      if (!preset || score === undefined) return;
      removeIfSaved(
        media,
        interpolate(dict.details.rate.toast.removedFromSaved, {
          emoji: preset.emoji,
          score: formatScore(locale, score),
        }),
      );
    },
    onError: (error) => {
      console.error('Saving a rating failed', { mediaItemId: media.mediaItemId, error });
      store.refresh(media.mediaItemId);
      toast.danger(dict.details.rate.toast.failed);
    },
  });

  return {
    rating: isPending && variables !== undefined ? variables : (mediaState?.rating ?? null),
    isResolving,
    rate: mutate,
  };
}
