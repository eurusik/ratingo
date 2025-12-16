/**
 * Client wrapper for DataVerdict to handle event handlers.
 * 
 * This wrapper is needed because event handlers (onSave) cannot be passed
 * from Server Components to Client Components in Next.js.
 */

'use client';

import { DataVerdict } from './data-verdict';
import type { DataVerdictProps } from './data-verdict';
import type { getDictionary } from '@/shared/i18n';

interface DataVerdictWrapperProps extends Omit<DataVerdictProps, 'ctaProps'> {
  ctaProps?: {
    isSaved?: boolean;
    hasNewEpisodes?: boolean;
    hintKey?: 'newEpisodes' | 'afterAllEpisodes' | 'whenOnStreaming' | 'notifyNewEpisode' | 'general';
    primaryCta?: 'SAVE' | 'CONTINUE' | 'OPEN';
    continuePoint?: { season: number; episode: number } | null;
  };
}

export function DataVerdictWrapper({ ctaProps, ...props }: DataVerdictWrapperProps) {
  // Handle CTA action client-side
  const handleCtaAction = () => {
    if (!ctaProps) return;

    const primaryCta = ctaProps.primaryCta || 'SAVE';
    
    // TODO: Implement actual save/continue/open logic
    console.log('CTA clicked:', primaryCta);
    
    // For now, just log
    if (primaryCta === 'SAVE') {
      console.log('TODO: Add to watchlist');
    } else if (primaryCta === 'CONTINUE') {
      console.log('TODO: Navigate to continue point:', ctaProps.continuePoint);
    } else if (primaryCta === 'OPEN') {
      console.log('TODO: Navigate to details/episodes');
    }
  };

  return (
    <DataVerdict
      {...props}
      ctaProps={ctaProps ? {
        ...ctaProps,
        onSave: handleCtaAction,
      } : undefined}
    />
  );
}
