/**
 * Interactive CTA button for verdict section.
 * 
 */

'use client';

import type { components } from '@ratingo/api-contract';
import { Bookmark, Check, ArrowRight, Info, Bell, BellOff } from 'lucide-react';
import { SUBSCRIPTION_TRIGGER } from '@/core/query';
import { type PrimaryCta, PRIMARY_CTA, type SubscriptionTrigger, type SubscriptionUnavailableReason } from '@/shared/types';
import { cn } from '@/shared/utils';
import type { getDictionary } from '@/shared/i18n';

/** Verdict hint key from API. */
type VerdictHintKey = components['schemas']['MovieVerdictDto']['hintKey'];

/** Verdict type from API + UI-only variants. */
type ApiVerdictType = components['schemas']['MovieVerdictDto']['type'];
type VerdictType = ApiVerdictType | 'season_comparison' | 'user_context';

interface VerdictCtaButtonProps {
  /** CTA type from card metadata. */
  primaryCta?: PrimaryCta;
  /** Continue point for CONTINUE CTA. */
  continuePoint?: { season: number; episode: number } | null;
  /** Is already saved. */
  isSaved?: boolean;
  /** Is loading save status. */
  isLoading?: boolean;
  /** Has new episodes. */
  hasNewEpisodes?: boolean;
  /** Custom hint key. */
  hintKey?: VerdictHintKey;
  /** Verdict type for styling. */
  verdictType: VerdictType;
  /** Dictionary for translations. */
  dict: ReturnType<typeof getDictionary>;
  /** Callback for save/unsave action. */
  onSave?: () => void;
  /** Media type for subscription trigger label. */
  /** Specific subscription trigger to show. Null means no subscription available. */
  subscriptionTrigger?: SubscriptionTrigger | null;
  /** Reason why subscription is unavailable (for tooltip). */
  subscriptionUnavailableReason?: SubscriptionUnavailableReason;
  /** Is subscribed to notifications. */
  isSubscribed?: boolean;
  /** Is subscription loading. */
  isSubscriptionLoading?: boolean;
  /** Callback for subscription toggle. */
  onSubscriptionToggle?: () => void;
}

export function VerdictCtaButton({
  primaryCta = PRIMARY_CTA.SAVE,
  continuePoint,
  isSaved = false,
  isLoading = false,
  hasNewEpisodes,
  hintKey,
  verdictType,
  dict,
  onSave,
  subscriptionTrigger,
  subscriptionUnavailableReason,
  isSubscribed = false,
  isSubscriptionLoading = false,
  onSubscriptionToggle,
}: VerdictCtaButtonProps) {
  // Show skeleton while loading save status
  if (isLoading && primaryCta === PRIMARY_CTA.SAVE) {
    return (
      <div className="flex items-center justify-between w-full mt-4 pt-4 border-t border-zinc-800/50 -mx-5 px-5 -mb-5 pb-5">
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse" />
          <div className="h-3 w-32 bg-zinc-800/60 rounded animate-pulse" />
        </div>
        <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
      </div>
    );
  }
  const handleClick = () => {
    switch (primaryCta) {
      case PRIMARY_CTA.SAVE:
        onSave?.();
        break;
      case PRIMARY_CTA.CONTINUE:
        // TODO: Navigate to continue point
        break;
      case PRIMARY_CTA.OPEN:
        // TODO: Navigate to details/episodes
        break;
    }
  };

  // CTA config based on primaryCta type
  const ctaTypeConfig = {
    [PRIMARY_CTA.SAVE]: {
      icon: isSaved ? Check : Bookmark,
      label: isSaved ? dict.details.saved : dict.details.save,
      iconColor: isSaved ? 'text-green-500' : 'text-zinc-500 group-hover:text-zinc-300',
      iconBg: isSaved ? 'bg-green-500/20' : 'bg-zinc-800 group-hover:bg-zinc-700',
      showHint: !isSaved,
    },
    [PRIMARY_CTA.CONTINUE]: {
      icon: ArrowRight,
      label: continuePoint 
        ? `${dict.details.continue} S${continuePoint.season}E${continuePoint.episode}`
        : dict.details.continue,
      iconColor: 'text-green-400',
      iconBg: 'bg-green-500/20',
      showHint: false,
    },
    [PRIMARY_CTA.OPEN]: {
      icon: Info,
      label: dict.card.cta.details,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/20',
      showHint: false,
    },
  } as const;

  const config = ctaTypeConfig[primaryCta!];
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

  // Subscription label based on trigger (passed from parent)
  // If subscriptionTrigger is null, subscription is not available for this item
  const subscriptionLabel = subscriptionTrigger 
    ? dict.saved.trigger[subscriptionTrigger]
    : null;

  return (
    <>
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
            primaryCta === PRIMARY_CTA.SAVE && isSaved ? 'text-green-400' : 'text-zinc-200'
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
          {/* Subscription toggle - inline when saved and subscription is available */}
          {isSaved && primaryCta === PRIMARY_CTA.SAVE && onSubscriptionToggle && subscriptionLabel && (
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onSubscriptionToggle();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onSubscriptionToggle();
                }
              }}
              className={cn(
                'flex items-center gap-1.5 mt-1.5 text-left transition-colors cursor-pointer',
                isSubscriptionLoading && 'opacity-50 pointer-events-none'
              )}
            >
              {isSubscribed ? (
                <Bell className="w-3 h-3 text-emerald-400" />
              ) : (
                <BellOff className="w-3 h-3 text-zinc-500" />
              )}
              <span className={cn(
                'text-xs transition-colors',
                isSubscribed ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-400'
              )}>
                {isSubscribed 
                  ? `${subscriptionLabel} ✓`
                  : `${dict.saved.actions.subscribe}: ${subscriptionLabel}`
                }
              </span>
            </div>
          )}
          {/* Disabled subscription button when unavailable (e.g., Planned/Pilot without date) */}
          {isSaved && primaryCta === PRIMARY_CTA.SAVE && !subscriptionLabel && subscriptionUnavailableReason && (
            <button
              type="button"
              disabled
              title={dict.saved.unavailable[subscriptionUnavailableReason]}
              onClick={() => {
                // TODO: Track subscription_unavailable_click when analytics is implemented
                console.debug('[Analytics] subscription_unavailable_click', { reason: subscriptionUnavailableReason });
              }}
              className="flex items-center gap-1.5 mt-1.5 text-zinc-600 cursor-not-allowed opacity-60"
            >
              <BellOff className="w-3 h-3" />
              <span className="text-xs">
                {subscriptionUnavailableReason === 'already_available' 
                  ? `✓ ${dict.saved.unavailable.already_available}`
                  : dict.saved.actions.subscribe
                }
              </span>
            </button>
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
    </>
  );
}
