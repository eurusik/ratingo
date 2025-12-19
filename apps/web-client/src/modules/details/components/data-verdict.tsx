/**
 * Client component for DataVerdict with CTA actions.
 * Wraps DataVerdictServer with save/unsave hooks.
 */

'use client';

import { useState, useEffect } from 'react';
import type { components } from '@ratingo/api-contract';
import { toast } from 'sonner';
import { type PrimaryCta, PRIMARY_CTA } from '@/shared/types';
import type { SavedItemList } from '@/core/api';
import { useAuth, useAuthModalStore } from '@/core/auth';
import { DataVerdictServer, type DataVerdictServerProps } from './data-verdict-server';
import { useSaveStatus, useSaveItem, useUnsaveItem, useSubscriptionStatus, useSubscribe, useUnsubscribe } from '@/core/query';
import { getSubscriptionTrigger, type ShowStatus } from '../utils';

type VerdictHintKey = components['schemas']['MovieVerdictDto']['hintKey'];

const DEFAULT_LIST: SavedItemList = 'for_later';
const CTA_CONTEXT = 'verdict';


interface DataVerdictProps extends Omit<DataVerdictServerProps, 'ctaProps'> {
  /** Media item ID for fetching save status. */
  mediaItemId: string;
  /** Media type for subscription trigger selection. */
  mediaType: 'movie' | 'show';
  /** Whether the movie is already released (releaseDate in past). */
  isReleased?: boolean;
  /** Whether the movie has streaming providers available. */
  hasStreamingProviders?: boolean;
  /** For shows: current production status (Returning Series, Ended, etc.) */
  showStatus?: ShowStatus;
  ctaProps?: {
    hasNewEpisodes?: boolean;
    hintKey?: VerdictHintKey;
    primaryCta?: PrimaryCta;
    continuePoint?: { season: number; episode: number } | null;
  };
}

export function DataVerdict({ mediaItemId, mediaType, isReleased = false, hasStreamingProviders = false, showStatus, ctaProps, ...props }: DataVerdictProps) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const openLogin = useAuthModalStore((s) => s.openLogin);
  const [isHydrated, setIsHydrated] = useState(false);
  
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  
  const { data: saveStatus, isFetched } = useSaveStatus(mediaItemId, {
    enabled: isAuthenticated && !!mediaItemId,
  });
  
  const { data: subscriptionStatus } = useSubscriptionStatus(mediaItemId, {
    enabled: isAuthenticated && !!mediaItemId,
  });
  
  const { mutate: saveItem, isPending: isSaving } = useSaveItem();
  const { mutate: unsaveItem, isPending: isUnsaving } = useUnsaveItem();
  const { mutate: subscribe, isPending: isSubscribing } = useSubscribe();
  const { mutate: unsubscribe, isPending: isUnsubscribing } = useUnsubscribe();

  const isSaved = saveStatus?.isForLater ?? false;
  const isMutating = isSaving || isUnsaving;
  const isCtaLoading = !isHydrated || isAuthLoading || (isAuthenticated && !isFetched);
  
  const subscriptionTrigger = getSubscriptionTrigger({ mediaType, isReleased, hasStreamingProviders, showStatus });
  const isSubscribed = subscriptionTrigger 
    ? (subscriptionStatus?.triggers?.includes(subscriptionTrigger) ?? false)
    : false;
  const isSubscriptionMutating = isSubscribing || isUnsubscribing;
  
  const handleSubscriptionToggle = () => {
    if (isSubscriptionMutating || !subscriptionTrigger) return;
    
    if (isSubscribed) {
      unsubscribe({ mediaItemId, trigger: subscriptionTrigger, context: CTA_CONTEXT });
    } else {
      subscribe({ mediaItemId, trigger: subscriptionTrigger, context: CTA_CONTEXT });
    }
  };

  const handleCtaAction = () => {
    if (!ctaProps || isMutating) return;

    const primaryCta = ctaProps.primaryCta ?? PRIMARY_CTA.SAVE;
    
    // Show login modal for guests
    if (!isAuthenticated && primaryCta === PRIMARY_CTA.SAVE) {
      openLogin();
      return;
    }
    
    switch (primaryCta) {
      case PRIMARY_CTA.SAVE:
        if (isSaved) {
          unsaveItem(
            { mediaItemId, list: DEFAULT_LIST, context: CTA_CONTEXT },
            {
              onSuccess: () => toast.success(props.dict.saved.toast.unsaved),
              onError: () => toast.error(props.dict.saved.toast.error),
            }
          );
        } else {
          saveItem(
            { 
              mediaItemId, 
              list: DEFAULT_LIST, 
              context: CTA_CONTEXT,
              reasonKey: props.messageKey ?? undefined,
            },
            {
              onSuccess: () => toast.success(props.dict.saved.toast.saved),
              onError: () => toast.error(props.dict.saved.toast.error),
            }
          );
        }
        break;
      case PRIMARY_CTA.CONTINUE:
        // TODO: Navigate to continue point
        break;
      case PRIMARY_CTA.OPEN:
        // TODO: Navigate to details/episodes
        break;
    }
  };

  return (
    <DataVerdictServer
      {...props}
      ctaProps={ctaProps ? {
        ...ctaProps,
        isSaved,
        isLoading: isCtaLoading,
        onSave: handleCtaAction,
        // Subscription props
        mediaType,
        subscriptionTrigger,
        isSubscribed,
        isSubscriptionLoading: isSubscriptionMutating,
        onSubscriptionToggle: handleSubscriptionToggle,
      } : undefined}
    />
  );
}

export type { DataVerdictProps };
