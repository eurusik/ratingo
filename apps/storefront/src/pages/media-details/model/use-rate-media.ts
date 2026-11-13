'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { useLibrarySave } from '@/features/save-to-library';
import { LIBRARY_QUERY_KEY, useMediaState, useMediaStateStore } from '@/entities/library';
import { libraryApi, type MediaType, type WatchState } from '@/shared/api';
import { interpolate, useTranslation, type Dictionary, type Locale } from '@/shared/i18n';
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
  rate: (rating: number) => void;
  clear: () => void;
}

function dropsFromSaved(stateBefore: WatchState | undefined): boolean {
  return !(stateBefore && STATES_KEPT_ON_RATING.has(stateBefore));
}

function removedFromSavedMessage(rating: number, dict: Dictionary, locale: Locale): string {
  return interpolate(dict.details.rate.toast.removedFromSaved, {
    emoji: presetForRating(rating)?.emoji ?? '',
    score: formatScore(locale, scoreFromPercent(rating) ?? 0),
  });
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
    onMutate: () => ({ before: store.read(media.mediaItemId) }),
    onSuccess: (saved, rating, { before }) => {
      store.write(media.mediaItemId, saved);
      if (rating !== null && dropsFromSaved(before?.state)) {
        removeIfSaved(media, removedFromSavedMessage(rating, dict, locale));
      }
      const previousRating = before?.rating;
      if (rating === null && previousRating != null) {
        toast(dict.details.rate.toast.cleared, {
          actionProps: {
            children: dict.details.rate.toast.undo,
            variant: 'tertiary',
            onPress: () => mutate(previousRating),
          },
        });
      }
    },
    onError: (error) => {
      console.error('Saving a rating failed', { mediaItemId: media.mediaItemId, error });
      store.refresh(media.mediaItemId);
      toast.danger(dict.details.rate.toast.failed);
    },
  });

  const rating = isPending && variables !== undefined ? variables : (mediaState?.rating ?? null);

  return {
    rating,
    isResolving,
    rate: (next) => {
      if (next !== rating) mutate(next);
    },
    clear: () => mutate(null),
  };
}
