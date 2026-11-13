'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { useLibrarySave } from '@/features/save-to-library';
import { LIBRARY_QUERY_KEY, useMediaState, useMediaStateStore } from '@/entities/library';
import { libraryApi, type MediaType, type WatchState } from '@/shared/api';
import { interpolate, useTranslation, type Dictionary, type Locale } from '@/shared/i18n';
import { formatScore, scoreFromRating, showUndoToast } from '@/shared/lib';
import { presetForRating } from './rating-presets';

interface RatableMedia {
  mediaItemId: string;
  type: MediaType;
  title: string;
}

const STATES_KEPT_IN_LIBRARY_ON_RATING = new Set<WatchState>(['watching', 'paused', 'caught_up']);

export interface MediaRating {
  rating: number | null;
  isResolving: boolean;
  rate: (rating: number) => void;
  clear: () => void;
}

function ratingRemovesFromWatchlist(stateBefore: WatchState | undefined): boolean {
  return !(stateBefore && STATES_KEPT_IN_LIBRARY_ON_RATING.has(stateBefore));
}

function removedFromSavedMessage(rating: number, dict: Dictionary, locale: Locale): string {
  return interpolate(dict.details.rate.toast.removedFromSaved, {
    emoji: presetForRating(rating)?.emoji ?? '',
    score: formatScore(locale, scoreFromRating(rating)),
  });
}

export function useRateMedia(media: RatableMedia): MediaRating {
  const { dict, locale } = useTranslation();
  const store = useMediaStateStore();
  const { removeIfSaved } = useLibrarySave();
  const { mediaState, isResolving } = useMediaState(media.mediaItemId);

  const removeFromWatchlistIfNeeded = (rating: number, stateBefore: WatchState | undefined) => {
    if (ratingRemovesFromWatchlist(stateBefore)) {
      removeIfSaved(media, removedFromSavedMessage(rating, dict, locale));
    }
  };

  const { mutate, isPending, variables } = useMutation({
    mutationKey: [...LIBRARY_QUERY_KEY, 'rate', media.mediaItemId],
    scope: { id: `rate:${media.mediaItemId}` },
    mutationFn: async (rating: number | null) => {
      const before = store.read(media.mediaItemId);
      const saved = await libraryApi.setRating(media.mediaItemId, rating, media.type);
      return { before, saved };
    },
    onSuccess: ({ before, saved }, rating) => {
      store.write(media.mediaItemId, saved);
      if (rating !== null) removeFromWatchlistIfNeeded(rating, before?.state);
    },
    onError: (error) => {
      console.error('Saving a rating failed', { mediaItemId: media.mediaItemId, error });
      store.refresh(media.mediaItemId);
      toast.danger(dict.details.rate.toast.failed);
    },
  });

  const rating = isPending && variables !== undefined ? variables : (mediaState?.rating ?? null);

  const offerUndoClear = (previousRating: number) => {
    showUndoToast({
      key: `rating:${media.mediaItemId}`,
      message: dict.details.rate.toast.cleared,
      undoLabel: dict.details.rate.toast.undo,
      onUndo: () => mutate(previousRating),
    });
  };

  return {
    rating,
    isResolving,
    rate: (next) => {
      if (next !== rating) mutate(next);
    },
    clear: () =>
      mutate(null, {
        onSuccess: ({ before }) => {
          if (before?.rating != null) offerUndoClear(before.rating);
        },
      }),
  };
}
