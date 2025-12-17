/**
 * Interactive CTA button for verdict section.
 * 
 */

'use client';

import { Bookmark, Check, ArrowRight, Info } from 'lucide-react';
import type { PrimaryCta } from '@/shared/types';
import { cn } from '@/shared/utils';
import type { getDictionary } from '@/shared/i18n';
type VerdictType = 'season_comparison' | 'user_context' | 'general' | 'quality' | 'popularity' | 'release' | 'warning';

interface VerdictCtaButtonProps {
  /** CTA type from card metadata */
  primaryCta?: PrimaryCta;
  /** Continue point for CONTINUE CTA */
  continuePoint?: { season: number; episode: number } | null;
  /** Is already saved */
  isSaved?: boolean;
  /** Has new episodes */
  hasNewEpisodes?: boolean;
  /** Custom hint key */
  hintKey?: 'newEpisodes' | 'afterAllEpisodes' | 'whenOnStreaming' | 'notifyNewEpisode' | 'general' | 'forLater' | 'notifyRelease' | 'decideToWatch';
  /** Verdict type for styling */
  verdictType: VerdictType;
  /** Dictionary for translations */
  dict: ReturnType<typeof getDictionary>;
}

export function VerdictCtaButton({
  primaryCta = 'SAVE',
  continuePoint,
  isSaved = false,
  hasNewEpisodes,
  hintKey,
  verdictType,
  dict,
}: VerdictCtaButtonProps) {
  // Handle CTA click
  const handleClick = () => {
    // TODO: Implement actual save/continue/open logic
    console.log('CTA clicked:', primaryCta);
    
    if (primaryCta === 'SAVE') {
      console.log('TODO: Add to watchlist');
    } else if (primaryCta === 'CONTINUE') {
      console.log('TODO: Navigate to continue point:', continuePoint);
    } else if (primaryCta === 'OPEN') {
      console.log('TODO: Navigate to details/episodes');
    }
  };

  // CTA config based on primaryCta type
  const ctaTypeConfig = {
    SAVE: {
      icon: isSaved ? Check : Bookmark,
      label: isSaved ? dict.details.saved : dict.details.save,
      iconColor: isSaved ? 'text-green-500' : 'text-zinc-500 group-hover:text-zinc-300',
      iconBg: isSaved ? 'bg-green-500/20' : 'bg-zinc-800 group-hover:bg-zinc-700',
      showHint: !isSaved,
    },
    CONTINUE: {
      icon: ArrowRight,
      label: continuePoint 
        ? `${dict.details.continue} S${continuePoint.season}E${continuePoint.episode}`
        : dict.details.continue,
      iconColor: 'text-green-400',
      iconBg: 'bg-green-500/20',
      showHint: false,
    },
    OPEN: {
      icon: Info,
      label: dict.card.cta.details,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/20',
      showHint: false,
    },
  } as const;

  const config = ctaTypeConfig[primaryCta];
  const CtaIcon = config.icon;

  // Dynamic CTA gradient based on verdict type
  const ctaGradientClasses: Record<VerdictType, string> = {
    season_comparison: 'bg-gradient-to-r from-amber-500/10 via-transparent to-transparent border-amber-500/20 hover:border-amber-500/30 hover:from-amber-500/15',
    user_context: 'bg-gradient-to-r from-blue-500/10 via-transparent to-transparent border-blue-500/20 hover:border-blue-500/30 hover:from-blue-500/15',
    general: 'bg-gradient-to-r from-zinc-500/10 via-transparent to-transparent border-zinc-500/20 hover:border-zinc-500/30 hover:from-zinc-500/15',
    quality: 'bg-gradient-to-r from-green-500/10 via-transparent to-transparent border-green-500/20 hover:border-green-500/30 hover:from-green-500/15',
    popularity: 'bg-gradient-to-r from-purple-500/10 via-transparent to-transparent border-purple-500/20 hover:border-purple-500/30 hover:from-purple-500/15',
    release: 'bg-gradient-to-r from-cyan-500/10 via-transparent to-transparent border-cyan-500/20 hover:border-cyan-500/30 hover:from-cyan-500/15',
    warning: 'bg-gradient-to-r from-orange-500/10 via-transparent to-transparent border-orange-500/20 hover:border-orange-500/30 hover:from-orange-500/15',
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'group flex items-center justify-between w-full mt-4 pt-4 border-t',
        '-mx-5 px-5 -mb-5 pb-5 rounded-b-2xl',
        ctaGradientClasses[verdictType],
        'transition-all'
      )}
    >
      <div className="flex flex-col items-start">
        <span className={cn(
          'text-sm font-medium',
          primaryCta === 'SAVE' && isSaved ? 'text-green-400' : 'text-zinc-200'
        )}>
          {config.label}
        </span>
        {config.showHint && (
          <span className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
            {hintKey 
              ? dict.details.cta.saveHint[hintKey]
              : hasNewEpisodes
                ? dict.details.cta.saveHint.newEpisodes
                : dict.details.cta.saveHint.general}
          </span>
        )}
      </div>
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center transition-all',
        config.iconBg
      )}>
        <CtaIcon className={cn(
          'w-4 h-4 transition-all',
          config.iconColor
        )} />
      </div>
    </button>
  );
}
