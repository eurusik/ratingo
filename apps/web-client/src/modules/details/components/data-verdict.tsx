/**
 * Client component for DataVerdict with CTA actions.
 * Wraps DataVerdictServer with save/unsave hooks.
 */

'use client';

import type { components } from '@ratingo/api-contract';
import { toast } from 'sonner';
import type { PrimaryCta } from '@/shared/types';
import type { SavedItemList } from '@/core/api';
import { DataVerdictServer, type DataVerdictServerProps } from './data-verdict-server';
import { useSaveStatus, useSaveItem, useUnsaveItem } from '@/core/query';

type VerdictHintKey = components['schemas']['MovieVerdictDto']['hintKey'];

const DEFAULT_LIST: SavedItemList = 'for_later';
const CTA_CONTEXT = 'verdict';

const TOAST_MESSAGES = {
  saved: 'Збережено',
  unsaved: 'Видалено зі збережених',
  error: 'Не вдалося зберегти',
} as const;

interface DataVerdictProps extends Omit<DataVerdictServerProps, 'ctaProps'> {
  /** Media item ID for fetching save status. */
  mediaItemId: string;
  ctaProps?: {
    hasNewEpisodes?: boolean;
    hintKey?: VerdictHintKey;
    primaryCta?: PrimaryCta;
    continuePoint?: { season: number; episode: number } | null;
  };
}

export function DataVerdict({ mediaItemId, ctaProps, ...props }: DataVerdictProps) {
  const { data: saveStatus } = useSaveStatus(mediaItemId, {
    enabled: !!mediaItemId,
  });
  
  const { mutate: saveItem, isPending: isSaving } = useSaveItem();
  const { mutate: unsaveItem, isPending: isUnsaving } = useUnsaveItem();

  const isSaved = saveStatus?.isForLater ?? false;
  const isLoading = isSaving || isUnsaving;

  const handleCtaAction = () => {
    if (!ctaProps || isLoading) return;

    const primaryCta = ctaProps.primaryCta ?? 'SAVE';
    
    switch (primaryCta) {
      case 'SAVE':
        if (isSaved) {
          unsaveItem(
            { mediaItemId, list: DEFAULT_LIST, context: CTA_CONTEXT },
            {
              onSuccess: () => toast.success(TOAST_MESSAGES.unsaved),
              onError: () => toast.error(TOAST_MESSAGES.error),
            }
          );
        } else {
          saveItem(
            { mediaItemId, list: DEFAULT_LIST, context: CTA_CONTEXT },
            {
              onSuccess: () => toast.success(TOAST_MESSAGES.saved),
              onError: () => toast.error(TOAST_MESSAGES.error),
            }
          );
        }
        break;
      case 'CONTINUE':
        // TODO: Navigate to continue point
        break;
      case 'OPEN':
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
        onSave: handleCtaAction,
      } : undefined}
    />
  );
}

export type { DataVerdictProps };
